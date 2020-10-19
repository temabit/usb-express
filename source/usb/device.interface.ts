import { TypedEmitter } from '@temabit/extension-io/lib';
import libusb from '@temabit/usb';
import { NameSpace } from 'typed-patterns';

export enum ENDPOINT_DIRECTION {
	IN = 'IN',
	OUT = 'OUT'
}

export enum TRANSFER_TYPE {
	CONTROL = 'CONTROL',
	ISOCHRONOUS = 'ISOCHRONOUS',
	BULK = 'BULK',
	INTERRUPT = 'INTERRUPT'
}

export enum INTERFACE_CLASS {
	PER_INTERFACE = 'PER_INTERFACE',
	AUDIO = 'AUDIO',
	COMM = 'COMM',
	HID = 'HID',
	PRINTER = 'PRINTER',
	PTP = 'PTP',
	MASS_STORAGE = 'MASS_STORAGE',
	HUB = 'HUB',
	DATA = 'DATA',
	WIRELESS = 'WIRELESS',
	APPLICATION = 'APPLICATION',
	VENDOR_SPEC = 'VENDOR_SPEC'
}

export enum REQUEST_TYPE {
	STANDARD = 'STANDARD',
	CLASS = 'CLASS',
	VENDOR = 'VENDOR',
	RESERVED = 'RESERVED'
}

export enum REQUEST_RECIPIENT {
	DEVICE = 'DEVICE',
	INTERFACE = 'INTERFACE',
	ENDPOINT = 'ENDPOINT',
	OTHER = 'OTHER'
}

export enum REQUEST_DIRECTION {
	IN = 'IN',
	OUT = 'OUT'
}

export enum STD_REQUEST {
	GET_STATUS = libusb.LIBUSB_REQUEST_GET_STATUS,
	CLEAR_FEATURE = libusb.LIBUSB_REQUEST_CLEAR_FEATURE,
	SET_FEATURE = libusb.LIBUSB_REQUEST_SET_FEATURE,
	SET_ADDRESS = libusb.LIBUSB_REQUEST_SET_ADDRESS,
	GET_DESCRIPTOR = libusb.LIBUSB_REQUEST_GET_DESCRIPTOR,
	SET_DESCRIPTOR = libusb.LIBUSB_REQUEST_SET_DESCRIPTOR,
	GET_CONFIGURATION = libusb.LIBUSB_REQUEST_GET_CONFIGURATION,
	SET_CONFIGURATION = libusb.LIBUSB_REQUEST_SET_CONFIGURATION,
	GET_INTERFACE = libusb.LIBUSB_REQUEST_GET_INTERFACE,
	SET_INTERFACE = libusb.LIBUSB_REQUEST_SET_INTERFACE,
	SYNCH_FRAME = libusb.LIBUSB_REQUEST_SYNCH_FRAME
}

export enum LIBUSB_ERROR_CODE {
	TRANSFER_ERROR = libusb.LIBUSB_TRANSFER_ERROR,
	TRANSFER_NO_DEVICE = libusb.LIBUSB_TRANSFER_NO_DEVICE,
	TRANSFER_CANCELLED = libusb.LIBUSB_TRANSFER_CANCELLED,
	TRANSFER_STALL = libusb.LIBUSB_TRANSFER_STALL,
	TRANSFER_OVERFLOW = libusb.LIBUSB_TRANSFER_OVERFLOW,
	TRANSFER_TIMED_OUT = libusb.LIBUSB_TRANSFER_TIMED_OUT,

	ERROR_IO = libusb.LIBUSB_ERROR_IO,
	ERROR_INVALID_PARAM = libusb.LIBUSB_ERROR_INVALID_PARAM,
	ERROR_NO_DEVICE = libusb.LIBUSB_ERROR_NO_DEVICE,
	ERROR_NOT_FOUND = libusb.LIBUSB_ERROR_NOT_FOUND,
	ERROR_BUSY = libusb.LIBUSB_ERROR_BUSY,
	ERROR_TIMEOUT = libusb.LIBUSB_ERROR_TIMEOUT,
	ERROR_OVERFLOW = libusb.LIBUSB_ERROR_OVERFLOW,
	ERROR_PIPE = libusb.LIBUSB_ERROR_PIPE,
	ERROR_INTERRUPTED = libusb.LIBUSB_ERROR_INTERRUPTED,
	ERROR_NO_MEM = libusb.LIBUSB_ERROR_NO_MEM,
	ERROR_NOT_SUPPORTED = libusb.LIBUSB_ERROR_NOT_SUPPORTED,
	ERROR_OTHER = libusb.LIBUSB_ERROR_OTHER,
}

export enum USB_ERROR {
	TRANSFER_ERROR = 'LIBUSB_TRANSFER_ERROR',
	TRANSFER_NO_DEVICE = 'LIBUSB_TRANSFER_NO_DEVICE',
	TRANSFER_CANCELLED = 'LIBUSB_TRANSFER_CANCELLED',
	TRANSFER_STALL = 'LIBUSB_TRANSFER_STALL',
	TRANSFER_OVERFLOW = 'LIBUSB_TRANSFER_OVERFLOW',
	TRANSFER_TIMED_OUT = 'LIBUSB_TRANSFER_TIMED_OUT',

	ERROR_IO = 'LIBUSB_ERROR_IO',
	ERROR_INVALID_PARAM = 'LIBUSB_ERROR_INVALID_PARAM',
	ERROR_NO_DEVICE = 'LIBUSB_ERROR_NO_DEVICE',
	ERROR_NOT_FOUND = 'LIBUSB_ERROR_NOT_FOUND',
	ERROR_BUSY = 'LIBUSB_ERROR_BUSY',
	ERROR_TIMEOUT = 'LIBUSB_ERROR_TIMEOUT',
	ERROR_OVERFLOW = 'LIBUSB_ERROR_OVERFLOW',
	ERROR_PIPE = 'LIBUSB_ERROR_PIPE',
	ERROR_INTERRUPTED = 'LIBUSB_ERROR_INTERRUPTED',
	ERROR_NO_MEM = 'LIBUSB_ERROR_NO_MEM',
	ERROR_NOT_SUPPORTED = 'LIBUSB_ERROR_NOT_SUPPORTED',
	ERROR_OTHER = 'LIBUSB_ERROR_OTHER',
}

interface USBDeviceEventMap extends NameSpace<any[]> {
	detach: [];
}

export interface Version {
	major: number;
	minor: number;
}

export interface USBDeviceDescriptor {
	readonly USB: Version;
	readonly Device: Version;

	readonly VendorId: number;
	readonly ProductId: number;

	readonly VendorName?: string;
	readonly ProductName?: string;

	readonly Length: number;
	readonly DescriptorType: number;
	readonly DeviceClass: number;
	readonly DeviceSubClass: number;
	readonly DeviceProtocol: number;
	readonly MaxPacketSize0: number;
	readonly NumConfigurations: number;

	readonly Manufacturer?: string;
	readonly Product?: string;
	readonly SerialNumber?: string;
}

export interface RequestBase {
	direction: REQUEST_DIRECTION;
	type: REQUEST_TYPE;
	recipient: REQUEST_RECIPIENT;
	request: number;
	value: number;
	index: number;
	data: number | Buffer;
}

export interface InputRequest extends RequestBase {
	direction: REQUEST_DIRECTION.IN;
	data: number;
}

export function isInputRequest(request: RequestBase): request is InputRequest {
	return request.direction === REQUEST_DIRECTION.IN;
}

export interface OutputRequest extends RequestBase {
	direction: REQUEST_DIRECTION.OUT;
	data: Buffer;
}

export function isOutputRequest(request: RequestBase): request is OutputRequest {
	return request.direction === REQUEST_DIRECTION.OUT;
}

export interface USBDevice extends TypedEmitter<USBDeviceEventMap> {
	readonly parent?: Promise<USBDevice>;
	readonly interfaces: ReadonlyMap<number, USBInterface>;
	readonly descriptor: USBDeviceDescriptor;

	controlTransfer(request: InputRequest): Promise<Buffer>;
	controlTransfer(request: OutputRequest): Promise<void>;
	controlTransfer(request: RequestBase): Promise<Buffer | void>;

	getStringDescriptor(descriptor: number): Promise<string>;
	reset(): Promise<void>;
	close(): void;
}

export interface USBInterfaceDescriptor {
	readonly Length: number;
	readonly DescriptorType: number;
	readonly InterfaceNumber: number;
	readonly AlternateSetting: number;
	readonly NumEndpoints: number;
	readonly InterfaceClass: number;
	readonly InterfaceSubClass: number;
	readonly InterfaceProtocol: number;

	readonly Interface: string;

	readonly extra: Buffer;
}

export interface USBEndpointDescriptor {
	readonly Length: number;
	readonly DescriptorType: number;
	readonly EndpointAddress: number;
	readonly Attributes: number;
	readonly MaxPacketSize: number;
	readonly Interval: number;
	readonly Refresh: number;
	readonly SynchAddress: number;
	readonly extra: Buffer;
}

export interface USBInterface {
	readonly device: USBDevice;
	readonly interfaceNumber: number;
	readonly isClaimed: boolean;
	readonly isKernelDriverActive: boolean;
	readonly endpoints: ReadonlyMap<number, USBEndpoint>;

	claim(): void;
	release(close?: boolean): Promise<void>;
	attachKernelDriver(): void;
	detachKernelDriver(): void;
}

export interface USBEndpoint {
	readonly interface: USBInterface;
	readonly address: number;
	readonly transferType: TRANSFER_TYPE;
	readonly direction: ENDPOINT_DIRECTION;
	timeout: number;
	readonly descriptor: USBEndpointDescriptor;
	clearHalt(): Promise<void>;
}

interface USBInEndpointEventMap extends NameSpace<any[]> {
	data: [Buffer];
	error: [Error];
	close: [];
}

export interface USBInEndpoint extends USBEndpoint, TypedEmitter<USBInEndpointEventMap> {
	readonly direction: ENDPOINT_DIRECTION.IN;
	transfer(length: number): Promise<Buffer>;
	startPoll(nTransfers?: number, transferSize?: number): void;
	stopPoll(): Promise<void>;
}

export function isInEndpoint(endpoint: USBEndpoint): endpoint is USBInEndpoint {
	return endpoint.direction === ENDPOINT_DIRECTION.IN;
}

export interface USBOutEndpoint extends USBEndpoint {
	readonly direction: ENDPOINT_DIRECTION.OUT;
	transfer(buffer: Buffer): Promise<void>;
	transferWithZLP(buf: Buffer): Promise<void>;
}

export function isOutEndpoint(endpoint: USBEndpoint): endpoint is USBOutEndpoint {
	return endpoint.direction === ENDPOINT_DIRECTION.OUT;
}
