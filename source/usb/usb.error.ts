import { USB_ERROR } from './device.interface';

export class USBError extends Error {
  public readonly code: USB_ERROR;

  public constructor(message: string, code: USB_ERROR, stack?: string) {
    super(message);
    this.code = code;
    Object.defineProperties(this, {
      name: {
        value: this.constructor.name,
        configurable: false,
        enumerable: false,
        writable: false,
      }
    });
    if (stack) {
      Object.defineProperties(this, {
        stack: {
          value: stack,
          configurable: false,
          enumerable: false,
          writable: false,
        },
      });
    }
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
