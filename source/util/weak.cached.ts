export function WeakCached<ThisType, ArgumentType extends object, ResultType, OtherType extends any[]>(
	this: ThisType,
	raw: (this: ThisType, argument: ArgumentType, ...args: OtherType) => ResultType
): (this: ThisType, argument: ArgumentType, ...args: OtherType) => ResultType {
	let cache: WeakMap<ArgumentType, { result?: ResultType, error?: Error }> = new WeakMap();
	let _this = this;

	function cached(argument: ArgumentType, ..._args: OtherType): ResultType {
		let old = cache.get(argument);
		if (!old) {
			try {
				cache.set(argument, old = { result: (raw as Function).apply(_this, arguments) });
			} catch (e) {
				cache.set(argument, old = { error: e });
			}
		}
		if (old.error) {
			throw old.error;
		} else {
			return old.result!;
		}
	}

	let nameDescriptor = Object.getOwnPropertyDescriptor(raw, 'name');
	if (nameDescriptor && typeof (nameDescriptor.value) === 'string') {
		nameDescriptor.value = 'WeakCached[' + nameDescriptor.value + ']';
		Object.defineProperty(cached, 'name', nameDescriptor);
	}
	return cached;
}
