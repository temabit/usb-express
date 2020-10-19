import { EventEmitter } from 'events';
import libusb from '@temabit/usb';
import debug from 'debug';
import { AsyncProcessor } from 'typed-patterns';
import { List } from '../util/linked.list';
import { createDevice } from './device.impl';
import { USBDevice } from './device.interface';
const debuglog = debug('usb-express');


export type AttachHandler = (device: USBDevice, next: () => void) => any;

export interface AttachContext {
	device: USBDevice;
	claim: () => void;
	release: () => void;
}

export interface AttachResolution {
	device: USBDevice;
	detach?: AsyncProcessor<USBDevice, []>;
}

export type AttachProcessor = AsyncProcessor<AttachContext, [AttachResolution]>;



var _instance: USBExpress | null;

export class USBExpress {
	private readonly _handlers: WeakMap<AttachHandler, AttachProcessor>;
	private readonly _chain: List<AttachProcessor>;
	private readonly _unusedDevices: Set<libusb.Device>;
	private readonly _allDevices: Map<libusb.Device, USBDevice>;

	public static get Instance(): USBExpress {
		if (!_instance) {
			_instance = new USBExpress();
		}
		return _instance;
	}

	private readonly _close = (_device: libusb.Device, usbDevice: USBDevice) => {
		let promises: Promise<void>[] = [];
		for (let iface of usbDevice.interfaces.values()) {
			promises.push(iface.release(true).catch((error) => console.warn(`Interface release error %o`, error)));
		}
		Promise.all(promises).then(() => usbDevice.close());
	};

	private readonly _handleDevice = (
		device: libusb.Device,
		usbDevice: USBDevice,
		start?: IListElement<AttachHandler>,
	) => {
		this._allDevices.set(device, usbDevice);
		debuglog('handleDevice{VENDOR=%j, PRODUCT=%j}', usbDevice.descriptor.VendorName, usbDevice.descriptor.ProductName);
		let listElement = start || this._chain.next;
		this._unusedDevices.delete(device);
		const next = (): void => {
			if (isListHead(listElement)) {
				this._unusedDevices.add(device);
			} else if (isLoadedElement(listElement)) {
				let handler = listElement.payload;
				listElement = listElement.next;
				process.nextTick(handler, usbDevice, next);
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
		createDevice(device).then(this._handleDevice.bind(this, device), this._handleDeviceError.bind(this, device));
	};

	private readonly _onDeviceDetach = (device: libusb.Device, closeManually?: boolean): void => {
		debuglog('DEVICE DETACH %j', device.deviceDescriptor);
		let usbDevice = this._allDevices.get(device);
		if (usbDevice) {
			this._allDevices.delete(device);
			if (!this._unusedDevices.has(device)) {
				this._unusedDevices.delete(device);
				usbDevice.emit('detach');
			}
			if (closeManually) {
				this._close(device, usbDevice);
			}
		}
	};

	private constructor() {
		this._chain = listCreate();
		this._unusedDevices = new Set();
		this._allDevices = new Map();

		process.once('SIGINT', this.stop);
		libusb.on('attach', this._onDeviceAttach);
		libusb.on('detach', this._onDeviceDetach);
		for (let device of libusb.getDeviceList()) {
			this._onDeviceAttach(device);
		}
	}

	public attach(handler: AttachHandler): void {
		let element = listPrepend(this._chain, handler);
		for (let [device, usbDevice] of this._allDevices) {
			if (this._unusedDevices.has(device)) {
				this._handleDevice(device, usbDevice, element);
			}
		}
	}

	public addHandler(handler: AttachHandler): void {

	}

	public removeHandler(handler: AttachHandler): void {

	}

	public addProcessor(processor: AttachProcessor): void {

	}

	public removeProcessor(processor: AttachProcessor): void {

	}

	public stop = () => {
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
}
