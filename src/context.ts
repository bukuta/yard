import { Ajax } from './types'
import { getAjax } from './ajax'

interface ContextOption {
  ajax?: Ajax
}
const defaultAjax: Ajax = getAjax({
  prefix: '/api/v1',
  parse(rs: any): any { return rs; },
});

class Context {
  ajax: Ajax;
  constructor(contextOption: ContextOption) {
    if (contextOption.ajax) {
      this.ajax = contextOption.ajax;
    } else {
      this.ajax = defaultAjax;
    }
  }

  add(model: NewableFunction) {
    model.prototype.__context__ = this;
  }
}

export default Context;
