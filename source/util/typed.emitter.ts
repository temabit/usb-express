import {EventEmitter} from 'events';
import { NameSpace, TypedFunction } from 'typed-patterns';

export interface TypedEmitter<EventMap = NameSpace<any[]>> extends EventEmitter {
  addListener<Event extends keyof EventMap>(
    event: Event,
    listener: EventMap[Event] extends any[] ? TypedFunction<EventMap[Event], void> : TypedFunction<unknown[], void>,
  ): this;
  addListener(event: string | symbol, listener: TypedFunction<any[], void>): this;

  on<Event extends keyof EventMap>(
    event: Event,
    listener: EventMap[Event] extends any[] ? TypedFunction<EventMap[Event], void> : TypedFunction<unknown[], void>,
  ): this;
  on(event: string | symbol, listener: TypedFunction<any[], void>): this;

  off<Event extends keyof EventMap>(
    event: Event,
    listener: EventMap[Event] extends any[] ? TypedFunction<EventMap[Event], void> : TypedFunction<unknown[], void>,
  ): this;
  off(event: string | symbol, listener: TypedFunction<any[], void>): this;

  once<Event extends keyof EventMap>(
    event: Event,
    listener: EventMap[Event] extends any[] ? TypedFunction<EventMap[Event], void> : TypedFunction<unknown[], void>,
  ): this;
  once(event: string | symbol, listener: TypedFunction<any[], void>): this;

  prependListener<Event extends keyof EventMap>(
    event: Event,
    listener: EventMap[Event] extends any[] ? TypedFunction<EventMap[Event], void> : TypedFunction<unknown[], void>,
  ): this;
  prependListener(event: string | symbol, listener: TypedFunction<any[], void>): this;

  prependOnceListener<Event extends keyof EventMap>(
    event: Event,
    listener: EventMap[Event] extends any[] ? TypedFunction<EventMap[Event], void> : TypedFunction<unknown[], void>,
  ): this;
  prependOnceListener(event: string | symbol, listener: TypedFunction<any[], void>): this;

  removeListener<Event extends keyof EventMap>(
    event: Event,
    listener: EventMap[Event] extends any[] ? TypedFunction<EventMap[Event], void> : TypedFunction<unknown[], void>,
  ): this;
  removeListener(event: string | symbol, listener: TypedFunction<any[], void>): this;

  emit<Event extends keyof EventMap>(
    event: Event,
    ...args: EventMap[Event] extends any[] ? EventMap[Event] : unknown[]
  ): boolean;
  emit(event: string | symbol, ...args: any[]): boolean;
}
