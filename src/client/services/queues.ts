import {
  BehaviorSubject,
  concat,
  firstValueFrom,
  merge,
  Subject,
  of
} from 'rxjs';
import { Change } from '../../lib/asyncUtils';
import { map, filter, first, concatMap, mergeMap } from 'rxjs/operators';
import { isDefined } from '../../lib/typeUtils';
import { $D } from 'rxjs-debug';
import { logger } from '../../server/services/logger';


export class TaskQueue {
  queue$ = new Subject<{}>();
  completed$ = new Subject<{}>();
  active$ = new BehaviorSubject<Set<{}>>(new Set());

  constructor(maxSize: number) {
    this.queue$.pipe(
      concatMap(addedId => {
        return this.active$.pipe(
          first(active => active.size < maxSize),
          map(active => {
            active.add(addedId);
            return active;
          })
        );
      })
    ).subscribe(this.active$);

    this.completed$
      .pipe(
        map(completedId => {
          this.active$.value.delete(completedId);
          return this.active$.value;
        })
      ).subscribe(this.active$);


    this.active$.subscribe((active) => {
      console.log('cache size: ', active.size);
    });
  }

  async enqueue() {
    const id = {};
    this.queue$.next(id);
    await firstValueFrom(this.active$.pipe(filter(active => active.has(id))));
    return {
      complete: () => {
        this.completed$.next(id);
      }
    };
  }
}

export const requestQueue = new TaskQueue(80);
