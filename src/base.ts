/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
// import ajax from '$foreground/server/services/ajax';
// import {dateSymbol} from '$common/utils/index';
import Context from './context';
import { getAjax } from './ajax';
import { join as joinPath } from 'path';
import * as querystring from 'querystring';
import * as _ from 'lodash';

import {
  ModelResponse, CollectionResponse,
  Newable, ObjectData, AjaxError, ResponseData,
  QueryOption, PayloadOption,
  Ajax,
  HttpMethod
} from './types';

const SYMBOL_RPC = Symbol('rpc');

interface urlFactory {
  (): string;
}

type IdAttribute = string;
type Total = number;
type PageNumber = number;
type PageSize = number;
type BaseUrl = string | urlFactory;
type UrlType = string | urlFactory;

type Items = (string | number | ObjectData)[]

interface InitOption {
  url: UrlType;
  rewrites?: ObjectData;
}

interface CollectionInitOption extends InitOption {
  base?: BaseUrl;
  model?: Newable;
  idAttribute?: IdAttribute;
}
interface ModelInitOption extends InitOption {
  item?: any;
  idAttribute?: IdAttribute;
}

function parse(res: ResponseData): ModelResponse | CollectionResponse {
  if (res.hasOwnProperty('code') && res.hasOwnProperty('data')) {
    if (res.code === 200) {
      if (res.data && res.data.list) {
        res.data.items = res.data.list;
      }
      if (res.data && res.data.items) {
        return {
          items: res.data.items,
          total: res.data.total || res.data.items.length,
        };
      }
      return res.data;
    }
    const err = new AjaxError(res.msg);
    err.code = res.code;
    err.data = res.data;
    throw err;
  } else {
    return res;
  }
}

const ajax: Ajax = getAjax({
  prefix: '/api/v1',
  parse,
});

const context = new Context({
  ajax,
});


class Base {
  _url: UrlType;
  _params: ObjectData;
  _rewrites: ObjectData;
  __context__: Context;
  constructor(option: InitOption) {
    this._url = option.url;
    this._params = {};
    this._rewrites = option.rewrites || {};
    this.__context__ = context;
  }

  get context() {
    return this.__context__ || context;
  }

  get ajax(): Ajax {
    return this.context.ajax;
  }

  get params() {
    return Object.assign({}, this._params);
  }
  setParams(k: string, v: any): Base;
  setParams(k: ObjectData): Base;
  setParams(k: string | ObjectData, ...rest: any[]) {
    if (typeof (k) === 'string') {
      this._params[k] = rest[0];
    } else {
      this._params = { ...this._params, ...k };
    }
    return this;
  }

  get url() {
    const ps = this.params;
    const url: string = typeof this._url === 'function' ? this._url() : this._url;
    const qs = querystring.stringify(ps);
    if (qs) {
      return `${url}?${qs}`;
    }
    return url;
  }

  get urlPathOnly() {
    const url: string = typeof this._url === 'function' ? this._url() : this._url;
    return url;
  }

  set url(u) {
    this._url = u;
  }

  get path() {
    const url = typeof this._url === 'function' ? this._url() : this._url;
    return url;
  }

  getUrl(type: string = ''): string {
    if (
      type
      && this._rewrites
      && this._rewrites[type]
      && typeof this._rewrites[type] === 'function'
    ) {
      return this._rewrites[type].call(this);
    }
    if ((type || 'get').toLowerCase() === 'get') {
      return this.url;
    }
    return this.urlPathOnly;
  }

  fetch(options?: QueryOption) {
    options = Object.assign(
      {
        path: this.getUrl(),
        method: 'GET',
      },
      options,
    );

    return this.ajax.request(options);
  }

  update(payload: PayloadOption) {
    delete payload.id;
    delete payload.creator;
    const data = payload;

    return this.ajax
      .request({
        path: this.getUrl('update'),
        // query: this.params,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        // payload: JSON.stringify(payload),
        body: JSON.stringify(data),
      })
  }

  replace(payload: PayloadOption) {
    delete payload.id;
    delete payload.creator;
    const data = payload;

    return this.ajax
      .request({
        path: this.getUrl('update'),
        // query: this.params,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        // payload: JSON.stringify(payload),
        body: JSON.stringify(data),
      })
  }

  _fetch(options: QueryOption) {
    options = {
      path: this.getUrl(),
      query: this.params,
      method: 'GET',
      ...options,
    };
    return this.ajax.request(options);
  }

  exsert(name: string) {
    const that = this;
    const url = function url() {
      return joinPath(that.path, name);
    };
    const collection = new BaseCollection({
      url,
    });
    return collection;
  }

  exsertCollection(name: string | Function, Collection?: Newable, options?: CollectionInitOption) {
    Collection = Collection || BaseCollection;
    const that = this;
    const url = function url() {
      if (typeof name === 'function') {
        return joinPath(that.path, name());
      }
      return joinPath(that.path, name);
    };
    const collection = new Collection({
      ...options,
      url,
    });
    return collection;
  }

  exsertModel(name: string | Function, Model?: Newable) {
    Model = Model || BaseModel;
    const that = this;
    const url = function url() {
      if (typeof name === 'function') {
        return joinPath(that.path, name());
      }
      return joinPath(that.path, name);
    };
    const model = new Model({
      url,
    });
    return model;
  }
}

class BaseModel extends Base {
  _item: ObjectData;
  _idAttribute: IdAttribute;
  constructor(option: ModelInitOption) {
    const { item, idAttribute } = option;
    super(option);
    this._item = item;
    this._idAttribute = idAttribute || 'id';
  }

  get idAttribute() {
    return this._idAttribute || 'id';
  }

  get id() {
    return this._item && this._item[this.idAttribute];
  }

  fetch() {
    return super.fetch().then((rs: ModelResponse) => {
      this._item = rs;
      return rs;
    });
  }

  _getDiff(newObject: ObjectData, _oldObject?: ObjectData) {
    const diff = new Map<string, any>();
    const originItem = this._item || _oldObject || {};
    Object.entries(newObject)
      .forEach((entry: [string, unknown]) => {
        let [k, v] = entry;
        if (originItem[k] !== v) {
          diff.set(k, v);
        }
      });
    return diff;
  }

  destroy(options: ObjectData = {}) {
    // console.warn('model.destroy', this.getUrl('delete'));
    const { query } = options;
    return this.ajax
      .request({
        path: this.getUrl('delete'),
        query,
        method: 'DELETE',
      })
  }
}
// var roles = new Roles();
// var role = roles.select(id);
// var groups = role.stretch('groups');
// var groups = role.exsert('groups'); OK
// var groups = role.extend('groups');
// var groups = role.reach('groups');
// var groups = role.subCollection('groups');


class BaseCollection extends Base {
  _items: Items = [];
  _total: Total = 0;
  _page: PageNumber = 0;
  _pagesize: PageSize = 20;
  _Model: Newable;
  _idAttribute: IdAttribute = 'id';
  _base: BaseUrl = '';

  constructor(options: CollectionInitOption) {
    super(options);
    this._items = [];
    this._page = 1;
    this._base = options.base || '';
    this._pagesize = 20;
    this._Model = (options && options.model) || BaseModel;
    this._idAttribute = (options && options.idAttribute) || 'id';
  }

  get base() {
    return this._base || this.urlPathOnly;
  }

  set page(pg) {
    this._page = pg;
  }

  get page() {
    return this._page;
  }

  set pageSize(ps) {
    this._pagesize = ps;
  }

  get pageSize() {
    return this._pagesize;
  }

  get total() {
    return this._total;
  }

  get idAttribute() {
    return this._idAttribute || 'id';
  }

  get params() {
    return {
      ...this._params,
      // ...{
      //   // pageNum: this.page,
      //   // pagesize: this.pageSize,
      //   // limit,
      //   // offset
      // }
    };
  }

  fetch(options: QueryOption) {
    return super
      .fetch({
        ...this.params,
        ...options,
      })
      .then((rs: ObjectData | CollectionResponse) => {
        rs as CollectionResponse;
        console.warn('fetched', rs);
        const { items, total } = rs;
        this._items = items;
        this._total = total;
        return {
          items,
          total,
        };
      });
  }

  create(payload: object) {
    return this.ajax
      .request({
        path: this.getUrl('create'),
        query: this.params,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // payload: JSON.stringify(payload),
        body: JSON.stringify(payload),
      })
  }

  destroy(payload: object) {
    return this.ajax
      .request({
        path: `${this.getUrl('destroy')}/`,
        query: this.params,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        // payload: JSON.stringify(payload),
        body: JSON.stringify(payload),
      })
  }

  select(id: number | string | Function) {
    const idAttribute = this.idAttribute;
    const filteredItems = (this._items as ObjectData[] || []).filter((it: ObjectData) => it[idAttribute] === id);
    const target = filteredItems && filteredItems[0];
    const url = () => {
      if (typeof id !== 'function') {
        return `${this.base}/${id}`;
      }
      return `${this.base}/${id()}`;
    };

    const model = new this._Model({
      url,
      item: target,
    });
    return model;
  }
}

context.add(Base);
context.add(BaseModel);
context.add(BaseCollection);


function rpcForm(subpath: string, method: HttpMethod) {
  return function decorator(_target: DecoratorTarget, _name: DecoratorFunctionName, descriptor: PropertyDescriptor) {
    const fun = descriptor.value;

    descriptor.value = function newValue(rawOption: PayloadOption) {
      let thisObject = this as Base;
      const options = fun.call(this, rawOption) || {};
      options.method = method || 'POST';
      options.path = `/${(`${thisObject.url}/${subpath}`).split('/').filter(a => a).join('/')}`;
      options.headers = options.headers || {};

      if (options.body) {
        if (typeof (options.body) === 'object') {
          const body2 = { ...options.body };
          options.body = querystring.stringify(body2);
        } else {
          console.warn('The data type of the body must be the object type');
        }
      }

      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.headers.accept = 'application/json';

      return thisObject._fetch(options);
    };
    return descriptor;
  };
}

function rpcUpload(subpath: string, method: HttpMethod) {
  return function decorator(_target: DecoratorTarget, _name: DecoratorFunctionName, descriptor: PropertyDescriptor) {
    const fun = descriptor.value;

    descriptor.value = function newValue(rawOption: PayloadOption) {
      let thisObject = this as Base;
      const options = fun.call(this, rawOption) || {};
      options.method = method || 'POST';
      options.path = `/${(`${thisObject.url}/${subpath}`).split('/').filter(a => a).join('/')}`;
      options.headers = options.headers || {};

      if (options.body) {
        if (typeof (options.body) === 'object') {
          const formData = new FormData();
          const params = options.body;
          if (params) {
            for (const i of params) {
              if (params.hasOwnProperty(i)) {
                formData.append(i, params[i]);
              }
            }
          }
          options.body = formData;
          delete options.headers['Content-Type'];
        } else if (options.body instanceof FormData) {
          delete options.headers['Content-Type'];
        } else {
          console.warn('The data type of the body must be the formdata type');
        }
      }

      return thisObject._fetch(options);
    };
    return descriptor;
  };
}

type DecoratorFunctionName = string;

interface DecoratorTarget {
  [SYMBOL_RPC]: DecoratorFunctionName[];
}

function rpc(subpath: string, method: HttpMethod) {
  return function decorator(target: DecoratorTarget, name: DecoratorFunctionName, descriptor: PropertyDescriptor) {
    target[SYMBOL_RPC] = [...(target[SYMBOL_RPC] || []), name];
    const fun = descriptor.value;

    descriptor.value = function newValue(rawOption: PayloadOption) {
      const payload = rawOption;
      let thisObject = this as Base;
      const options = fun.call(this, rawOption) || {};

      options.method = method || 'POST';
      let subpath2 = subpath;
      if (subpath2.includes(':')) {
        subpath2 = subpath2.replace(/(:([^/]+))/g, (_matched: string, _$1: string, $2: string) => payload[$2]);
      }
      if (subpath2.startsWith('^/')) {
        options.path = subpath2.slice(2).split('/').filter(a => a).join('/');
      } else if (subpath2.startsWith('http://') || subpath2.startsWith('https://')) {
        options.path = subpath2;
      } else {
        options.path = `/${(`${thisObject.path}/${subpath2}`).split('/').filter(a => a).join('/')}`;
      }

      options.headers = options.headers || {};

      if (options.body) {
        if (typeof (options.body) === 'object') {
          const _body = Object.assign({}, options.body);
          options.body = JSON.stringify((_body));
        } else {
          console.warn('The data type of the body must be the object type');
        }
      }

      options.headers['Content-Type'] = 'application/json';
      options.headers.accept = 'application/json';

      return thisObject._fetch(options);
    };
    return descriptor;
  };
}
function getRpcs(target: Function) {
  console.log('getRpcs', target.prototype);
  console.log(target.prototype[SYMBOL_RPC]);
  const rpcs = target.prototype[SYMBOL_RPC];
  return rpcs;
}


export {
  Base, BaseModel, BaseCollection, ajax, context, rpc, rpcForm, rpcUpload, getRpcs,
};
