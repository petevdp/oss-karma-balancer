import { Observable } from 'rxjs';

export function listenToWorker<T>(worker: Worker) {
  return new Observable<MessageEvent<T>>((observer) => {
    function onMessage(ev: MessageEvent<T>) {
      observer.next(ev);
    }
    worker.addEventListener('message', onMessage);
    return () => worker.terminate()
  });
}
