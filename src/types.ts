import { HANDLED_ERRORS_KEY, INIT_FLAG_KEY } from "./constants";

export interface GlobalErrorOptions {
  onError?: (error: unknown) => void;
  onHttpError?: (error: unknown) => void;
}

export interface ExtendedWindow extends Window {
  [HANDLED_ERRORS_KEY]?: WeakSet<object>;
  [INIT_FLAG_KEY]?: boolean;
}
