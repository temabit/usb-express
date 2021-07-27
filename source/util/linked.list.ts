import { TypedFunction, TypedMethod } from 'typed-patterns';

abstract class AListElement {
	public prev: AListElement | null;
	public next: AListElement | null;

	protected constructor() {
		this.prev = null;
		this.next = null;
	}

	public get linked(): boolean {
		return !!(this.next && this.prev);
	}

	public unlink(): boolean {
		if (this.linked) {
			const {prev, next} = this;
			prev!.next = next;
			next!.prev = prev;
			this.next = null;
			this.prev = null;
			return true;
		} else {
			return false;
		}
	}

	public append(element: AListElement): void {
		element.unlink();
		const {next} = this;
		this.next = element;
		element.prev = this;
		element.next = next;
		if (next) {
			next.prev = element;
		}
	}

	public prepend(element: AListElement): void {
		element.unlink();
		const {prev} = this;
		this.prev = element;
		element.next = this;
		element.prev = prev;
		if (prev) {
			prev.next = element;
		}
	}
}

class ListHead<PayloadType = any> extends AListElement {
	public prev: ListElement<PayloadType> | ListHead;
	public next: ListElement<PayloadType> | ListHead;
	public constructor() {
		super();
		this.prev = this.next = this;
	}
}

class ListElement<PayloadType = any> extends AListElement {
	public prev!: ListElement<PayloadType> | ListHead | null;
	public next!: ListElement<PayloadType> | ListHead | null;
	public payload: PayloadType;

	public constructor(payload: PayloadType) {
		super();
		this.payload = payload;
	}
}

export class ListIterator<ValueType> implements Iterator<ValueType> {
	public constructor(initial: ListElement<ValueType> | ListHead<ValueType>) {
		this._current = initial;
	}

	public next(): IteratorResult<ValueType> {
		if (!this._current.linked) {
			throw new TypeError('Unlinked element');
		}
		this._current = this._current.next!;
		if (this._current instanceof ListHead) {
			return {
				value: undefined as any,
				done: true,
			};
		} else {
			return {
				value: this._current.payload,
				done: false,
			}
		}
	}

	private _current: ListHead<ValueType> | ListElement<ValueType>;
}

export class ListIndex<ValueType> {
	constructor(current: ListElement<ValueType> | ListHead<ValueType>) {
		this.current = current;
	}

	public get value(): ValueType | undefined {
		return this.current instanceof ListElement ? this.current.payload : undefined;
	}

	public backward(count: number = 1): ListIndex<ValueType> {
		if (count < 0) {
			return this.forward(-count);
		}
		let current: ListElement<ValueType> | ListHead<ValueType> = this.current;
		while (count > 0) {
			if (!current.linked) {
				throw new TypeError('Unlinked element');
			}
			current = current.prev!;
			--count;
		}
		return new ListIndex<ValueType>(current);
	}

	public forward(count: number = 1): ListIndex<ValueType> {
		if (count < 0) {
			return this.backward(-count);
		}
		let current: ListElement<ValueType> | ListHead<ValueType> = this.current;
		while (count > 0) {
			if (!current.linked) {
				throw new TypeError('Unlinked element');
			}
			current = current.next!;
			--count;
		}
		return new ListIndex<ValueType>(current);
	}

	public readonly current: ListElement<ValueType> | ListHead<ValueType>;
}

export class List<ValueType> implements Iterable<ValueType> {
	public constructor(items?: Iterable<ValueType>) {
		this._head = new ListHead();
		this._size = 0;
		if (items) {
			for (const item of items) {
				this.push(item);
			}
		}
	}

	public get empty(): boolean {
		return this._head.next === this._head;
	}

	public get size(): number {
		return this._size;
	}

	public push(...values: ValueType[]) {
		for (const value of values) {
			this._insertBefore(value, this._head);
		}
	}

	public pop(): ValueType | undefined {
		const prev = this._head.prev;
		if (prev instanceof ListHead) {
			return undefined;
		} else {
			const {payload} = prev;
			this._remove(prev);
			return payload;
		}
	}

	public shift(): ValueType | undefined {
		const next = this._head.next;
		if (next instanceof ListHead) {
			return undefined;
		} else {
			const {payload} = next;
			this._remove(next);
			return payload;
		}
	}

	public unshift(...values: ValueType[]) {
		const next = this._head.next;
		for (const value of values) {
			this._insertBefore(value, next);
		}
	}

	public findIndex(operator: TypedFunction<[ValueType], boolean>): ListIndex<ValueType>;
	public findIndex<InstanceType>(operator: TypedMethod<InstanceType, [ValueType], boolean>, thisArg: InstanceType): ListIndex<ValueType>;
	public findIndex(operator: TypedFunction<[ValueType], boolean>, thisArg?: any): ListIndex<ValueType> {
		const {_head} = this;
		for (let current = _head.next; current !== _head; current = current.next!) {
			if (current instanceof ListElement && operator.call(thisArg, current.payload)) {
				return new ListIndex(current);
			}
		}
		return new ListIndex(_head);
	}

	public remove(index: ListIndex<ValueType>) {
		this._remove(index.current);
	}

	public insertAfter(value: ValueType, index: ListIndex<ValueType>) {
		this._insertAfter(value, index.current);
	}

	public insertBefore(value: ValueType, index: ListIndex<ValueType>) {
		this._insertBefore(value, index.current);
	}

	public [Symbol.iterator](): Iterator<ValueType> {
		return new ListIterator(this._head);
	}

	private _remove(element: AListElement) {
		if (!(element instanceof ListHead) && element.unlink()) {
			--this._size;
		}
	}

	private _insertAfter(value: ValueType, element: AListElement) {
		element.append(new ListElement(value));
		this._size++;
	}

	private _insertBefore(value: ValueType, element: AListElement) {
		element.prepend(new ListElement(value));
		this._size++;
	}

	private _size: number;
	private readonly _head: ListHead<ValueType>;
}
