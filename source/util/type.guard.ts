export type TypeGuard<Base, Specific extends Base> = (value: Base) => value is Specific;
