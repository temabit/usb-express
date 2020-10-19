import { Unexpected } from 'typed-patterns';

export function nextProcessor(message?: string): never {
	throw new Unexpected(message || 'Unexpected context');
}
