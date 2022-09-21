import { Observable } from 'rxjs';

export function isPartialPopulated(partial: Partial<any>, keys: (keyof Partial<any>)[]): boolean {
  for (let key of keys) {
    if (partial[key as string] as any === undefined) return false;
  }
  return true;
}


export function ensurePartialPopulated<T>(partial: Partial<T>, keys: string[]): T {
  if (isPartialPopulated(partial, keys)) return partial as T;
  throw new Error('partial is unpopulated: ' + JSON.stringify(partial));
}

export type ReadOnlyMap<K, V> = Omit<Map<K, V>, 'set' | 'delete' | 'clear'>

export type PossibleError<T, E extends Error = Error> = {
  type: 'error';
  error: E;
} | {
  type: 'success';
  value: T;
}


export function emitCaughtErrors<T, E extends Error>(errorsToCatch: ErrorConstructor[], func: () => T | Promise<T>): Promise<PossibleError<T, E>> | PossibleError<T, E> {
  try {
    const out = func();
    if (out instanceof Promise) {
      return out.then((outInner) => {
        return {
          type: 'success',
          value: outInner
        };
      })
    }
    return {
      type: 'success',
      value: out
    }
  } catch (err: any) {
    for (let ErrorClass of errorsToCatch) {
      if (err instanceof ErrorClass) {
        return {
          type: 'error',
          error: err as E
        }
      }
    }
    throw err;
  }
}

export function coalesceToNull<T,E extends Error>(pe: PossibleError<T,E>) {
  if (pe.type === 'error') return null;
  return pe.value;
}

export function isNonNulled<T>(value: T): value is NonNullable<T> {
  return value != null;
}

export function isDefined<T>(val: T | undefined | null): val is T {
  return val !== undefined && val !== null;
}


type Falsy = false | 0 | '' | null | undefined;

// this is a type predicate - if x is `truthy`, then it's T
export const isTruthy = <T>(x: T | Falsy): x is T => !!x;


export function enumRepr(type: object, value: number): string {
  return (type as string[])[value] || '';
}
