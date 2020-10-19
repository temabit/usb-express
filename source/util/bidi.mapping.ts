
export interface BiDiMapping<KeyType, ValueType> {
	direct(key: KeyType): ValueType | undefined;
	reverse(value: ValueType): KeyType | undefined;
}

type StorageElement<KeyType, ValueType> = [KeyType, ValueType];

function _searcher(key: any, index: number): (value: StorageElement<any, any>) => boolean {
	return (value: StorageElement<any, any>): boolean => {
		return Object.is(value[index], key);
	};
}

class Mapping<KeyType, ValueType> implements BiDiMapping<KeyType, ValueType> {
	private readonly _values: Array<[KeyType, ValueType]>;

	public constructor(values: Iterable<[KeyType, ValueType]>) {
		this._values = Array.from(values);
	}

	public direct(key: KeyType): ValueType | undefined {
		let result = this._values.find(_searcher(key, 0));
		return result ? result[1] : undefined;
	}

	public reverse(value: ValueType): KeyType | undefined {
		let result = this._values.find(_searcher(value, 1));
		return result ? result[0] : undefined;
	}
}

export function createMapping<KeyType, ValueType>(values: Iterable<StorageElement<KeyType, ValueType>>): BiDiMapping<KeyType, ValueType> {
	return new Mapping(values);
}
