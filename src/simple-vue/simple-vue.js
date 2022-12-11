let TARGET = null;

const utils = {
  model(node, value, vm) {
    const initValue = this.getValue(value, vm);
    new Watcher(value, vm, (newVal) => {
      this.modelUpdater(node, newVal);
    });
    node.addEventListener("input", (e) => {
      const newVal = e.target.value;
      this.setValue(value, vm, newVal);
    });
    this.modelUpdater(node, initValue);
  },
  text(node, value, vm) {
    let result;
    if (value.includes("{{")) {
      result = value.replace(/\{\{(.+?)\}\}/g, (...args) => {
        const expr = args[1];
        new Watcher(expr, vm, (newVal) => {
          this.textUpdater(node, newVal);
        });
        return this.getValue(args[1], vm);
      });
    } else {
      result = this.getValue(args[1], vm);
    }

    this.textUpdater(node, result);
  },
  on(node, value, vm, eventName) {},

  textUpdater(node, value) {
    node.textContent = value;
  },
  modelUpdater(node, value) {
    node.value = value;
  },
  getValue(expr, vm) {
    return vm.$data[expr.trim()];
  },
  setValue(expr, vm, newVal) {
    vm.$data[expr] = newVal;
  },
};

class Watcher {
  constructor(expr, vm, cb) {
    this.expr = expr;
    this.vm = vm;
    this.cb = cb;
    // 通过getter对数据进行绑定，标记当前的watcher
    this.oldVal = this.getOldValue();
  }

  getOldValue() {
    TARGET = this;
    const oldValue = utils.getValue(this.expr, this.vm);
    TARGET = null;
    return oldValue;
  }

  update() {
    const newValue = utils.getValue(this.expr, this.vm);
    if (newValue !== this.oldValue) {
      this.cb(newValue);
    }
  }
}

class Dep {
  constructor() {
    this.collect = [];
  }

  addWatcher(watcher) {
    this.collect.push(watcher);
  }

  notify() {
    this.collect.forEach((w) => w.update());
  }
}

class Compiler {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el);

    this.vm = vm;

    const fragment = this.compileFragment(this.el);

    this.compile(fragment);
    this.el.appendChild(fragment);
  }

  compile(fragment) {
    const childNodes = Array.from(fragment.childNodes);
    childNodes.forEach((childNode) => {
      if (this.isElementNode(childNode)) {
        this.compileElement(childNode);
      } else if (this.isTextNode(childNode)) {
        // 文本节点 {{msg}}, 看是否有双括号
        this.compileText(childNode);
      }

      if (childNode.childNodes && childNode.childNodes.length) {
        this.compile(childNode);
      }
    });
  }

  compileFragment(el) {
    const f = document.createDocumentFragment();
    let firstChild;
    while ((firstChild = el.firstChild)) {
      f.appendChild(firstChild);
    }
    return f;
  }

  compileElement(node) {
    // v-
    const attributes = Array.from(node.attributes);
    attributes.forEach((attr) => {
      const { name, value } = attr;

      if (this.isDirector(name)) {
        const [, director] = name.split("-");
        const [compileKey, eventName] = director.split(":");
        utils[compileKey](node, value, this.vm, eventName);
      }
    });
  }

  compileText(node) {
    // {{msg}}
    const content = node.textContent;

    if (/\{\{(.+)\}\}/.test(content)) {
      utils["text"](node, content, this.vm);
    }
  }

  isDirector(name) {
    return name.startsWith("v-");
  }

  isElementNode(el) {
    return el.nodeType === 1;
  }

  isTextNode(el) {
    return el.nodeType === 3;
  }
}

class Observer {
  constructor(data) {
    this.observe(data);
  }

  observe(data) {
    if (data && typeof data === "object") {
      Object.keys(data).forEach((key) => {
        this.defineReactive(data, key, data[key]);
      });
    }
  }

  defineReactive(obj, key, value) {
    this.observe(value);
    const dep = new Dep();
    Object.defineProperty(obj, key, {
      get() {
        const target = TARGET;
        target && dep.addWatcher(target);
        return value;
      },
      set: (newVal) => {
        if (value === newVal) return;
        this.observe(newVal);
        value = newVal;
        dep.notify();
      },
    });
  }
}

class Vue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.$options = options;

    new Observer(this.$data);

    new Compiler(this.$el, this);

    this.proxyData(this.$data);
  }

  proxyData(data) {
    Object.keys(data).forEach((key) => {
      Object.defineProperty(this, key, {
        get() {
          return data[key];
        },
        set(newVal) {
          data[key] = newVal;
        },
      });
    });
  }
}
