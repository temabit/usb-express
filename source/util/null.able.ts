export type NullAble<T> = {
  [key in keyof T]: T[key] | null;
}
