import { EventEmitter } from 'events';
import libusb from '@temabit/usb';
import debug from 'debug';
import { format } from 'util';
import { List } from '../util/linked.list';
import { createDevice } from './device.impl';
import { USBDevice } from './device.interface';
const debuglog = debug('usb-express');

function once<T extends (...args: any[]) => any>(operator: T): T {
	let cache: null | (() => ReturnType<T>) = null;
	return function (...args: Parameters<T>): ReturnType<T> {
		if (cache === null) {
			try {
				const r = operator(...args);
				cache = () => r;
			} catch (error) {
				cache = () => { throw error; };
			}
		} else {
			debuglog('DUP CALL OF %o', operator);
		}
		return cache();
	} as T;
}

export interface AttachHandler {
	(device: USBDevice, next: () => void): any;
	release?: (device: USBDevice, callback: (error: Error | null) => void) => void;
}

var _instance: USBExpress | null;

export class USBExpress {
	private readonly _chain: List<AttachHandler>;
	private readonly _allDevices: Map<libusb.Device, USBDevice>;
	private readonly _matchedDevices: Map<USBDevice, AttachHandler | null>;

	public static get Instance(): USBExpress {
		if (!_instance) {
			_instance = new USBExpress();
		}
		return _instance;
	}

	private readonly _close = (_device: libusb.Device, usbDevice: USBDevice, handler: AttachHandler | null) => {
		if (handler && handler.release) {
			handler.release(usbDevice, (error) => {
				if (error) {
					console.warn(`Device release error %o`, error);
				}
				usbDevice.close();
			});
		} else {
			Promise.allSettled(
				Array.from(usbDevice.interfaces.values()).map(
					async (iface) => {
						let error: any;
						for (let retry = 0; retry !== 3; ++retry) {
							if (iface.isClaimed) {
								try {
									await iface.release();
									return;
								} catch (e) {
									error = e;
								}
							}
						}
						throw error;
					}
				)
			).then(() => usbDevice.close());
		}
	};

	private readonly _handleDevice = (
		usbDevice: USBDevice,
		from?: Iterator<AttachHandler>,
	) => {
		let iterator = from || this._chain[Symbol.iterator]();
		const {VendorId, ProductId, Manufacturer, Product, SerialNumber} = usbDevice.descriptor;
		const id = format(
			'VID=%s PID=%s Manufacturer=%j Product=%j SN=%j',
			VendorId.toString(16).padStart(4, '0'),
			ProductId.toString(16).padStart(4, '0'),
			Manufacturer,
			Product,
			SerialNumber,
		);
		const next = (): void => {
			const { value: handler, done } = iterator.next();

			if (handler) {
				this._matchedDevices.set(usbDevice, handler);
				debuglog('handle %s Device{%sj}', handler.name, id);
				process.nextTick(handler, usbDevice, once(next));
			}

			if (done) {
				debuglog('DONE Device{%s}', id);
				this._matchedDevices.set(usbDevice, null);
			}
		};
		next();
	};

	private readonly _handleDeviceError = (device: libusb.Device, error: Error) => {
		debuglog(
			'Device{VID=0x%s, PID=0x%s} initialization error %o',
			device.deviceDescriptor.idVendor.toString(16).padStart(4, '0'),
			device.deviceDescriptor.idProduct.toString(16).padStart(4, '0'),
			error,
		);
		let release: Promise<any>;
		if (device.interfaces) {
			release = Promise.all(
				device.interfaces.map(
					(ep) =>
						new Promise((resolve) => {
							ep.release(true, resolve);
						}),
				),
			);
		} else {
			release = Promise.resolve();
		}
		release.then(() => device.close);
	};

	private readonly _onDeviceAttach = (device: libusb.Device): void => {
		debuglog('DEVICE ATTACH %j', device.deviceDescriptor);
		createDevice(device)
			.then(
				(usbDevice) => {
					this._allDevices.set(device, usbDevice);
					this._matchedDevices.set(usbDevice, null);
					this._handleDevice(usbDevice);
				},
				(error) => this._handleDeviceError(device, error),
			);
	};

	private readonly _onDeviceDetach = (device: libusb.Device, closeManually?: boolean): void => {
		debuglog('DEVICE DETACH %j', device.deviceDescriptor);
		const usbDevice = this._allDevices.get(device);
		if (usbDevice) {
			this._allDevices.delete(device);
			const handler = this._matchedDevices.get(usbDevice);
			this._matchedDevices.delete(usbDevice);
			if (handler) {
				usbDevice.emit('detach');
			}
			if (closeManually) {
				this._close(device, usbDevice, handler || null);
			}
		}
	};

	private constructor() {
		this._chain = new List();
		this._allDevices = new Map();
		this._matchedDevices = new Map();

		libusb.on('attach', this._onDeviceAttach);
		libusb.on('detach', this._onDeviceDetach);
		for (let device of libusb.getDeviceList()) {
			this._onDeviceAttach(device);
		}
	}

	public attach(handler: AttachHandler): void {
		const size = this._chain.size;
		this._chain.push(handler);

		for (const [usbDevice, handler] of this._matchedDevices) {
			const iterator = this._chain[Symbol.iterator]();
			for (let i = 0; i < size; ++i) {
				iterator.next();
			}
			if (!handler) {
				this._handleDevice(usbDevice, iterator);
			}
		}
	}

	public stop(): void {
		try {
			debuglog('STOP');
			/// @todo declare libusb as TypedEmitter
			(libusb as any as EventEmitter).removeListener('attach', this._onDeviceAttach);
			(libusb as any as EventEmitter).removeListener('detach', this._onDeviceDetach);

			for (let device of this._allDevices.keys()) {
				this._onDeviceDetach(device, true);
			}
		} catch (e) {
			debuglog('stop()', e);
		}
	};

	private readonly __stop = () => {
		this.stop();
	}
}
