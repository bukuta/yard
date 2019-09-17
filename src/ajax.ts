import { EventEmitter } from 'events';
import * as urllib from 'url';
import * as querystring from 'querystring';

import {
  QueryOption,
  AjaxError, AjaxOption,
} from './types.ts';

interface Parser {
  (rs: any): any;
}

class Ajax extends EventEmitter {
  prefix: string = "";
  parse: Parser = (rs) => rs;
  constructor(options: AjaxOption) {
    super();
    this.prefix = options.prefix;
    if (options.parse) {
      this.parse = options.parse;
    }
  }
  async request(options: QueryOption) {
    let requestObject = this.buildRequest(options);
    let rs = await this.doRequest(requestObject);
    rs = this.beforeParseResponse(rs);
    let value = await this.handleResponse(rs);
    value = this.afterParseResponse(value);
    return this.parse(value);
  }
  beforeBuildRequest(options: QueryOption): QueryOption {
    console.log('beforeBuildRequest', options)
    return {};
  }
  beforeParseResponse(rs: Response) {
    // 后处理0
    return rs;
  }
  afterParseResponse(rs: any) {
    // 后处理1
    return rs;
  }
  buildRequest(options: QueryOption) {
    // 修正url
    let prefix = this.prefix;
    const urlObject: urllib.UrlWithParsedQuery = urllib.parse(options.path || '', true);
    const originQuery = urlObject.query;

    options.credentials = options.credentials || 'include';
    if (options.body instanceof FormData) {
      options.headers = { Accept: 'application/json', ...options.headers };
    } else {
      options.headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers
      };
    }

    let query = {};
    if (options.query) {
      if (typeof (options.query) === 'object') {
        query = { ...originQuery, ...options.query };
      } else if (typeof (options.query) === 'string') {
        query = { ...originQuery, ...querystring.parse(options.query) };
      }
      urlObject.query = query;
      urlObject.search = '';
    }
    urlObject.pathname = `${prefix}/${urlObject.pathname}`;
    urlObject.pathname = urlObject.pathname.replace('//', '/');
    // 拦截
    let extra = this.beforeBuildRequest(options);
    options = { ...options, ...extra };

    let newUrl = urllib.format(urlObject);

    let request = new Request(newUrl, {
      credentials: options.credentials,
      headers: options.headers || {},
      method: options.method,
      body: options.body,
    });
    return request;
  }

  // 可以被覆盖
  async doRequest(requestOption: Request) {
    const rs = await window.fetch(requestOption);
    return rs;
  }
  async handleResponse(rs: Response) {
    let headers = rs.headers;
    let contentType = headers.get('Content-Type') || '';
    if (Math.ceil(rs.status / 100) === 2) {
      if (rs.status === 204) {
        return '';
      }
      if (contentType.indexOf('json')) {
        return rs.json().then(result => result);
      } if (contentType.indexOf('text')) {
        return rs.text();
      }
      throw new Error('Content-Type is can\'t recognize.');
    } else if (rs.status === 401) {
      const error = new AjaxError('UnAuthorized');
      error.responseCode = 401;
      this.emit('error', error);
      throw error;
    } else {
      if (contentType.indexOf('json')) {
        return rs.json().then((result) => {
          let error = new Error(result.message || result.msg || result.errmsg);
          error = Object.assign(error, result, {
            responseCode: rs.status,
          });
          this.emit('error', error);
          throw error;
        });
      } if (contentType.indexOf('text')) {
        return rs.text().then((text) => {
          const error = new AjaxError(text);
          error.responseCode = rs.status;
          error.message = text;
          this.emit('error', error);
          throw error;
        });
      }
      const error = new Error('Content-Type is can\'t recognize.');
      this.emit('error', error);
      throw error;
    }

  }
}

function getAjax(options: AjaxOption): Ajax {
  // const prefix = options.prefix;
  // const parse = options.parse || (a => a);

  const ajax: Ajax = new Ajax(options);
  return ajax;
}


export {
  getAjax,
};
