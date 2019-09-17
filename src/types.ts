import { EventEmitter } from 'events';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD';

interface Headers {
  [index: string]: string;
}

interface CollectionResponse {
  items: ModelResponse[];
  total: number;
}
interface ObjectData {
  [index: string]: any;
}

type ModelResponse = ObjectData;

interface ResponseData {
  data: any;
  code?: number | string;
  msg?: string;
  message?: string;
}

interface QueryOption extends ObjectData {
  path?: string;
  method?: HttpMethod;
  query?: string | object;
  body?: string | FormData | null;
  credentials?: RequestCredentials;
  headers?: Headers;
}

type PayloadOption = QueryOption;

type Callable = Function;

interface Newable {
  new(options: any): any;
}

class AjaxError extends Error {
  responseCode?: number;
  code?: number | string;
  data: any;
}

type Ajax = EventEmitter & {
  request(options: QueryOption): Promise<ModelResponse | CollectionResponse>;
}
interface AjaxOption {
  prefix: string;
  parse: (value: ResponseData) => ModelResponse | CollectionResponse;
}

export {
  Headers, HttpMethod,
  CollectionResponse, ModelResponse, ObjectData, ResponseData,
  QueryOption, PayloadOption,
  Callable, Newable,
  AjaxError, Ajax, AjaxOption,
};
