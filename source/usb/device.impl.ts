import * as libusb from '@temabit/usb';
import debug from 'debug';
import { EventEmitter } from 'events';
import { NameSpace } from 'typed-patterns';
import * as util from 'util';
import { ArrayMap } from '../util/array.map';
import { createMapping } from '../util/bidi.mapping';
import { ExceptionHandler } from '../util/exception.handler';
import { NullAble } from '../util/null.able';
import { WeakCached } from '../util/weak.cached';

import {
	ENDPOINT_DIRECTION,
	InputRequest,
	INTERFACE_CLASS,
	isInEndpoint,
	OutputRequest,
	REQUEST_DIRECTION,
	REQUEST_RECIPIENT,
	REQUEST_TYPE,
	RequestBase,
	TRANSFER_TYPE,
	USB_ERROR,
	USBDevice,
	USBDeviceDescriptor,
	USBEndpoint,
	USBEndpointDescriptor,
	USBInEndpoint,
	USBInterface,
	USBInterfaceDescriptor,
	USBOutEndpoint,
	Version,
} from './device.interface';
import { USBError } from './usb.error';


const debuglog = debug('usb-device');

const mappings = {
	ENDPOINT_DIRECTION: createMapping([
		[libusb.LIBUSB_ENDPOINT_IN, ENDPOINT_DIRECTION.IN],
		[libusb.LIBUSB_ENDPOINT_OUT, ENDPOINT_DIRECTION.OUT]
	]),
	TRANSFER_TYPE: createMapping([
		[libusb.LIBUSB_TRANSFER_TYPE_BULK, TRANSFER_TYPE.BULK],
		[libusb.LIBUSB_TRANSFER_TYPE_CONTROL, TRANSFER_TYPE.CONTROL],
		[libusb.LIBUSB_TRANSFER_TYPE_INTERRUPT, TRANSFER_TYPE.INTERRUPT],
		[libusb.LIBUSB_TRANSFER_TYPE_ISOCHRONOUS, TRANSFER_TYPE.ISOCHRONOUS]
	]),
	INTERFACE_CLASS: createMapping([
		[libusb.LIBUSB_CLASS_APPLICATION, INTERFACE_CLASS.APPLICATION],
		[libusb.LIBUSB_CLASS_AUDIO, INTERFACE_CLASS.AUDIO],
		[libusb.LIBUSB_CLASS_COMM, INTERFACE_CLASS.COMM],
		[libusb.LIBUSB_CLASS_DATA, INTERFACE_CLASS.DATA],
		[libusb.LIBUSB_CLASS_HID, INTERFACE_CLASS.HID],
		[libusb.LIBUSB_CLASS_HUB, INTERFACE_CLASS.HUB],
		[libusb.LIBUSB_CLASS_MASS_STORAGE, INTERFACE_CLASS.MASS_STORAGE],
		[libusb.LIBUSB_CLASS_PER_INTERFACE, INTERFACE_CLASS.PER_INTERFACE],
		[libusb.LIBUSB_CLASS_PRINTER, INTERFACE_CLASS.PRINTER],
		[libusb.LIBUSB_CLASS_PTP, INTERFACE_CLASS.PTP],
		[libusb.LIBUSB_CLASS_VENDOR_SPEC, INTERFACE_CLASS.VENDOR_SPEC],
		[libusb.LIBUSB_CLASS_WIRELESS, INTERFACE_CLASS.WIRELESS]
	]),
	REQUEST_TYPE: createMapping([
		[libusb.LIBUSB_REQUEST_TYPE_CLASS, REQUEST_TYPE.CLASS],
		[libusb.LIBUSB_REQUEST_TYPE_RESERVED, REQUEST_TYPE.RESERVED],
		[libusb.LIBUSB_REQUEST_TYPE_STANDARD, REQUEST_TYPE.STANDARD],
		[libusb.LIBUSB_REQUEST_TYPE_VENDOR, REQUEST_TYPE.VENDOR]
	]),
	REQUEST_RECIPIENT: createMapping([
		[libusb.LIBUSB_RECIPIENT_DEVICE, REQUEST_RECIPIENT.DEVICE],
		[libusb.LIBUSB_RECIPIENT_ENDPOINT, REQUEST_RECIPIENT.ENDPOINT],
		[libusb.LIBUSB_RECIPIENT_INTERFACE, REQUEST_RECIPIENT.INTERFACE],
		[libusb.LIBUSB_RECIPIENT_OTHER, REQUEST_RECIPIENT.OTHER]
	]),
	REQUEST_DIRECTION: createMapping([
		[libusb.LIBUSB_ENDPOINT_IN, REQUEST_DIRECTION.IN],
		[libusb.LIBUSB_ENDPOINT_OUT, REQUEST_DIRECTION.OUT]
	]),
	USB_ERROR: createMapping([
		[libusb.LIBUSB_TRANSFER_ERROR, USB_ERROR.TRANSFER_ERROR],
		[libusb.LIBUSB_TRANSFER_NO_DEVICE, USB_ERROR.TRANSFER_NO_DEVICE],
		[libusb.LIBUSB_TRANSFER_CANCELLED, USB_ERROR.TRANSFER_CANCELLED],
		[libusb.LIBUSB_TRANSFER_STALL, USB_ERROR.TRANSFER_STALL],
		[libusb.LIBUSB_TRANSFER_OVERFLOW, USB_ERROR.TRANSFER_OVERFLOW],
		[libusb.LIBUSB_TRANSFER_TIMED_OUT, USB_ERROR.TRANSFER_TIMED_OUT],
		[libusb.LIBUSB_ERROR_IO, USB_ERROR.ERROR_IO],
		[libusb.LIBUSB_ERROR_INVALID_PARAM, USB_ERROR.ERROR_INVALID_PARAM],
		[libusb.LIBUSB_ERROR_NO_DEVICE, USB_ERROR.ERROR_NO_DEVICE],
		[libusb.LIBUSB_ERROR_NOT_FOUND, USB_ERROR.ERROR_NOT_FOUND],
		[libusb.LIBUSB_ERROR_BUSY, USB_ERROR.ERROR_BUSY],
		[libusb.LIBUSB_ERROR_TIMEOUT, USB_ERROR.ERROR_TIMEOUT],
		[libusb.LIBUSB_ERROR_OVERFLOW, USB_ERROR.ERROR_OVERFLOW],
		[libusb.LIBUSB_ERROR_PIPE, USB_ERROR.ERROR_PIPE],
		[libusb.LIBUSB_ERROR_INTERRUPTED, USB_ERROR.ERROR_INTERRUPTED],
		[libusb.LIBUSB_ERROR_NO_MEM, USB_ERROR.ERROR_NO_MEM],
		[libusb.LIBUSB_ERROR_NOT_SUPPORTED, USB_ERROR.ERROR_NOT_SUPPORTED],
		[libusb.LIBUSB_ERROR_OTHER, USB_ERROR.ERROR_OTHER],
	]),
};


const ErrorMapper = (new ExceptionHandler())
	.addHandler((error) => {
		throw new USBError(error.message, mappings.USB_ERROR.direct((error as any).errno) || USB_ERROR.ERROR_OTHER, error.stack);
	}, Error);

function _wrap<ThisArg, Args extends any[], ResultType>(func: (this: ThisArg, ...args: Args) => Promise<ResultType>, thisArg: ThisArg): (...args: Args) => Promise<ResultType> {
	return (...args: Args) => func.apply(thisArg, args)
			.catch((error) =>
				ErrorMapper.handle(error) as never
			);
}

class Endpoint<Direction extends ENDPOINT_DIRECTION = ENDPOINT_DIRECTION> extends EventEmitter implements USBEndpoint {
	private readonly _base: libusb.Endpoint;
	public readonly descriptor: USBEndpointDescriptor;
	public readonly direction: Direction;
	public readonly interface: USBInterface;
	public readonly transferType: TRANSFER_TYPE;
	// public readonly clearHalt: () => Promise<void>;

	public constructor(base: libusb.Endpoint, iface: USBInterface, desc: USBEndpointDescriptor, direction: Direction) {
		super();

		this._base = base;
		this.interface = iface;
		this.descriptor = desc;
		this.direction = direction;
		this.transferType = mappings.TRANSFER_TYPE.direct(base.transferType)!;
		// this.clearHalt = _wrap(util.promisify(base.clearHalt), base);
	}

	public get address(): number {
		return this.descriptor.EndpointAddress;
	}

	public get timeout(): number {
		return this._base.timeout;
	}

	public set timeout(value: number) {
		this._base.timeout = value;
	}
}

class InEndpoint extends Endpoint<ENDPOINT_DIRECTION.IN> implements USBInEndpoint {
	public readonly transfer: (length: number) => Promise<Buffer>;
	public readonly startPoll: (nTransfers?: number, transferSize?: number) => void;
	public readonly stopPoll: () => Promise<void>;

	public constructor(base: libusb.InEndpoint, iface: USBInterface, desc: USBEndpointDescriptor) {
		super(base, iface, desc, ENDPOINT_DIRECTION.IN);
		this.transfer = _wrap(util.promisify(base.transfer), base);
		this.startPoll = (nTransfers, transferSize) => base.startPoll(nTransfers, transferSize);
		this.stopPoll = _wrap(util.promisify(base.stopPoll), base) as () => Promise<void>;
		for (let event of ['data', 'error', 'end']) {
			base.on(event, (...args: any[]) => this.emit(event, ...args));
		}
	}
}

class OutEndpoint extends Endpoint<ENDPOINT_DIRECTION.OUT> implements USBOutEndpoint {
	public readonly transfer: (buffer: Buffer) => Promise<void>;
	public readonly transferWithZLP: (buf: Buffer) => Promise<void>;

	public constructor(base: libusb.OutEndpoint, iface: USBInterface, desc: USBEndpointDescriptor) {
		super(base, iface, desc, ENDPOINT_DIRECTION.OUT);
		this.transfer = _wrap(util.promisify(base.transfer), base);
		this.transferWithZLP = _wrap(util.promisify(base.transferWithZLP), base);
		for (let event of ['close', 'error']) {
			base.on(event, (...args: any[]) => this.emit(event, ...args));
		}
	}
}

function getEndpointAddress(endpoint: USBEndpoint): number {
	return endpoint.address;
}

class Interface implements USBInterface {
	private readonly _base: libusb.Interface;
	private readonly _claim: () => void;
	private readonly _release: (closeEndpoints: boolean) => Promise<void>;
	private _isClaimed: boolean;

	public readonly device: USBDevice;
	public readonly descriptor: USBInterfaceDescriptor;
	public readonly endpoints: ArrayMap<number, USBEndpoint>;
	public readonly attachKernelDriver: () => void;
	public readonly detachKernelDriver: () => void;

	public constructor(base: libusb.Interface, device: USBDevice, desc: USBInterfaceDescriptor) {
		this._base = base;
		this._isClaimed = false;
		this.device = device;
		this.descriptor = desc;
		this.endpoints = new ArrayMap([], getEndpointAddress);
		this._claim = base.claim.bind(base);
		this._release = _wrap(util.promisify(base.release), base) as (closeEndpoints: boolean) => Promise<void>;
		this.attachKernelDriver = base.attachKernelDriver.bind(base);
		this.detachKernelDriver = base.detachKernelDriver.bind(base);
	}

	public get interfaceNumber(): number {
		return this._base.interfaceNumber;
	}

	public get isClaimed(): boolean {
		return this._isClaimed;
	}

	public get isKernelDriverActive(): boolean {
		return this._base.isKernelDriverActive();
	}

	public readonly claim = () => {
		if (!this._isClaimed) {
			this._claim();
			this._isClaimed = true;
		}
	}

	public readonly release = async (closeEndpoints: boolean = false) => {
		if (this._isClaimed) {
			this._isClaimed = false;
			if (closeEndpoints) {
				for (let ep of this.endpoints.values()) {
					if (isInEndpoint(ep)) {
						try {
							await ep.stopPoll();
						} catch (e) {
							debuglog('EP stopPoll', e);
						}
					}
					(ep as Endpoint).removeAllListeners();
				}
			}
			await this._release(closeEndpoints);
		}
	}
}

function getInterfaceNumber(iface: USBInterface): number {
	return iface.interfaceNumber;
}

function bufferToUtf8(buffer: Buffer): string {
	return buffer.toString('utf8');
}

class Device extends EventEmitter implements USBDevice {
	private readonly _base: libusb.Device;
	// tslint:disable-next-line:variable-name
	private readonly _controlTransfer: (bmRequestType: number, bRequest: number, wValue: number, wIndex: number, data_or_length: any) => Promise<Buffer | undefined>;
	private readonly _getStringDescriptor: (descriptor: number) => Promise<Buffer>;
	private readonly _reset: () => Promise<void>;

	public readonly descriptor: USBDeviceDescriptor;
	public readonly interfaces: ArrayMap<number, USBInterface>;
	public readonly parent?: Promise<USBDevice>;
	public readonly close: () => void;

	public constructor(base: libusb.Device, descriptor: USBDeviceDescriptor, parent?: Promise<USBDevice>) {
		super();
		this._base = base;
		this.parent = parent;
		this.descriptor = descriptor;
		this.interfaces = new ArrayMap([], getInterfaceNumber);
		this._controlTransfer = _wrap(util.promisify(base.controlTransfer), base) as (bmRequestType: number, bRequest: number, wValue: number, wIndex: number, data_or_length: any) => Promise<Buffer | undefined>;
		this._getStringDescriptor = _wrap(util.promisify(base.getStringDescriptor), base) as (descriptor: number) => Promise<Buffer>;
		this._reset = _wrap(util.promisify(base.reset), base) as () => Promise<void>;
		this.close = () => {
			debuglog('device.close()...');
			base.close();
			debuglog('device.close(): OK');
		};
	}

	public controlTransfer(request: InputRequest): Promise<Buffer>;
	public controlTransfer(request: OutputRequest): Promise<void>;
	public controlTransfer(request: RequestBase): Promise<Buffer | void>;
	public controlTransfer(request: InputRequest | OutputRequest | RequestBase): Promise<Buffer | void> {
		let requestType = (mappings.REQUEST_DIRECTION.reverse(request.direction) || 0)
			| (mappings.REQUEST_TYPE.reverse(request.type) || 0)
			| (mappings.REQUEST_RECIPIENT.reverse(request.recipient) || 0);
		return this._controlTransfer(requestType, request.request, request.value, request.index, request.data);
	}

	public readonly getStringDescriptor = (descriptor: number): Promise<string> => {
		return this._getStringDescriptor(descriptor).then(bufferToUtf8);
	};

	public readonly reset = (): Promise<void> => {
		return this._reset();
	}
}

async function resolveDescriptorValue(name: string, source: NameSpace, target: NameSpace, getStringDescriptor: (value: number) => Promise<string>): Promise<void> {
	let match = /^([a-z]+)([A-Z].*)$/.exec(name);
	if (match) {
		let value = source[name];
		let [, prefix, property] = match;
		// console.log('resolveDescriptorValue(%j){%j} => %j + %j', name, value, prefix, property);
		switch (prefix) {
			case 'b':
			case 'bm':
			case 'w':
				target[property] = value;
				break;
			case 'i':
				target[property] = await getStringDescriptor(value);
				break;
			case 'id':
				target[property + 'Id'] = value;
				target[property + 'Name'] = '0x' + value.toString(16).padStart(4, '0');
				break;
			case 'bcd':
				// tslint:disable-next-line:no-bitwise
				target[property] = { major: value >> 8, minor: value & 8 } as Version;
				break;
		}
	} else {
		// console.log('resolveDescriptorValue(%j)', name);
	}
}

async function resolveAllDescriptorValues(source: NameSpace, target: NameSpace, getStringDescriptor: (value: number) => Promise<string>): Promise<void> {
	for (const name of Object.keys(source)) {
		await resolveDescriptorValue(name, source, target, getStringDescriptor);
	}
}

function isValueNull(pair: [string, any]): boolean {
	return pair[1] === null;
}

const createEndpoint = WeakCached(async (endpoint: libusb.Endpoint, iface: USBInterface): Promise<USBEndpoint> => {
	let descriptor: NullAble<USBEndpointDescriptor> = {
		Length: null,
		Attributes: null,
		DescriptorType: null,
		EndpointAddress: null,
		Interval: null,
		MaxPacketSize: null,
		Refresh: null,
		SynchAddress: null,
		extra: endpoint.descriptor.extra
	};

	await resolveAllDescriptorValues(endpoint.descriptor, descriptor, iface.device.getStringDescriptor);
	let nullPair = Object.entries(descriptor).find(isValueNull);
	if (nullPair) {
		throw new Error(`Endpoint descriptor ${JSON.stringify(nullPair[0])} is NULL`);
	}
	if (endpoint instanceof libusb.InEndpoint) {
		return new InEndpoint(endpoint, iface, Object.freeze(descriptor as USBEndpointDescriptor));
	} else if (endpoint instanceof libusb.OutEndpoint) {
		return new OutEndpoint(endpoint, iface, Object.freeze(descriptor as USBEndpointDescriptor));
	} else {
		throw new Error('Invalid endpoint direction');
	}
});

const createInterface = WeakCached(async (iface: libusb.Interface, device: USBDevice): Promise<USBInterface> => {
	let descriptor: NullAble<USBInterfaceDescriptor> = {
		AlternateSetting: null,
		DescriptorType: null,
		Interface: null,
		InterfaceClass: null,
		InterfaceNumber: null,
		InterfaceProtocol: null,
		InterfaceSubClass: null,
		Length: null,
		NumEndpoints: null,

		extra: iface.descriptor.extra
	};

	await resolveAllDescriptorValues(iface.descriptor, descriptor, device.getStringDescriptor);
	let nullPair = Object.entries(descriptor).find(isValueNull);
	if (nullPair) {
		throw new Error(`Interface descriptor ${JSON.stringify(nullPair[0])} is NULL`);
	}
	let _iface = new Interface(iface, device, Object.freeze(descriptor as USBInterfaceDescriptor));
	for (let endpoint of iface.endpoints) {
		_iface.endpoints.addValue(await createEndpoint(endpoint, _iface));
	}
	return _iface;
});

export const createDevice = WeakCached(async (device: libusb.Device): Promise<USBDevice> => {
	let descriptor: NullAble<USBDeviceDescriptor> = {
		ProductId: null,
		VendorId: null,

		ProductName: null,
		VendorName: null,

		DescriptorType: null,
		DeviceClass: null,
		DeviceProtocol: null,
		DeviceSubClass: null,
		Length: null,
		Manufacturer: null,
		MaxPacketSize0: null,
		NumConfigurations: null,
		Product: null,
		SerialNumber: null,

		Device: null,
		USB: null
	};
	debuglog('device.open()...');
	device.open();
	debuglog('device.open(): OK');
	let getStringDescriptor = (value: number): Promise<string> => {
		let getDesc = _wrap(util.promisify(device.getStringDescriptor), device) as (value: number) => Promise<Buffer>;
		return getDesc(value).then(bufferToUtf8);
	};
	await resolveAllDescriptorValues(device.deviceDescriptor, descriptor, getStringDescriptor);
	let nullPair = Object.entries(descriptor).find(isValueNull);
	if (nullPair) {
		throw new Error(`Device descriptor ${JSON.stringify(nullPair[0])} is NULL`);
	}
	let parent = device.parent ? createDevice(device.parent) : undefined;
	let _dev = new Device(device, Object.freeze(descriptor as USBDeviceDescriptor), parent);
	for (let iface of device.interfaces) {
		_dev.interfaces.addValue(await createInterface(iface, _dev));
	}
	return _dev;
});
