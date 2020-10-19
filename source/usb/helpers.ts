import {
	InputRequest,
	OutputRequest,
	REQUEST_DIRECTION,
	REQUEST_RECIPIENT,
	REQUEST_TYPE, USBDevice,
	USBDeviceDescriptor
} from './device.interface';

export class USBRequestHelper {
	public static input(type: REQUEST_TYPE, recipient: REQUEST_RECIPIENT, request: number, value: number, index: number, length?: number): InputRequest {
		return {
			direction: REQUEST_DIRECTION.IN,
			type,
			recipient,
			request,
			value,
			index,
			data: length || 0
		};
	}

	public static output(type: REQUEST_TYPE, recipient: REQUEST_RECIPIENT, request: number, value: number, index: number, data?: Buffer): OutputRequest {
		return {
			direction: REQUEST_DIRECTION.OUT,
			type,
			recipient,
			request,
			value,
			index,
			data: data || Buffer.alloc(0)
		};
	}
}

export class USBDeviceSelector {
	public static byDescriptor(descriptor: Partial<USBDeviceDescriptor>): (device: USBDevice) => boolean {
		return (device: USBDevice): boolean => {
			for (let [key, value] of Object.entries(descriptor)) {
				if (device.descriptor[key as keyof USBDeviceDescriptor] !== value) {
					return false;
				}
			}
			return true;
		};
	}

	public static byIds(vid: number, pid: number): (device: USBDevice) => boolean {
		return USBDeviceSelector.byDescriptor({ VendorId: vid, ProductId: pid });
	}
}
