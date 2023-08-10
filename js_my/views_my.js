/*
 * @Author: BlueBoxChamil
 * @Date: 2023-07-27 14:08:13
 * @LastEditTime: 2023-08-02 14:35:46
 * @FilePath: \js_my\views_my.js
 * @Description: 
 * Copyright (c) 2023 by BlueBoxChamil, All Rights Reserved. 
 */
//辅助函数，用于设置对象属性的值。已了解
m.set = function (obj, prop, modify) {
    return function (value) { obj[prop] = modify ? modify(value) : value };
};

var ConnectForm = {
    // 对象控制器，参数是该控制器需要用到的外部依赖或者其他模块
    controller: function (api, client) {
        if (client && client.connected)
            return m.route('/connected');  //如果满足client存在的条件，导航到/connected路由

        // localStorage['connect:input']: 这是在浏览器中使用的 Web Storage API 的 localStorage 对象。
        // localStorage 允许开发者在浏览器中存储数据，并且数据在不同页面刷新或关闭后仍然保持不变。
        // 这里，它尝试获取名为 'connect:input' 的存储项。
        // JSON.parse(localStorage['connect:input']): 
        // 这段代码尝试将从 localStorage['connect:input'] 中获取的值解析为 JavaScript 对象。
        // localStorage 存储的值是字符串类型的，通过 JSON.parse() 方法，我们可以将其解析为 JavaScript 对象（如果值是合法的 JSON 格式）。
        // 总结：如果获取到合法josn数据，返回解析后的对象，否则返回false
        // 作用：检查本地存储是否尊在input项，有就解析，否则返回false
        this.props = (localStorage['connect:input'] && JSON.parse(localStorage['connect:input'])) ||
        {
            host: '',
            port: '',
            ssl: false,
            clean: true,
            keepalive: 30,
            clientId: '',
            username: '',
            password: '',
            reconnect: 0,
            will: {
                topic: '',
                qos: 0,
                retain: false,
                payload: '',
            }
        };
        //  页面卸载回调函数，作用是将props以josn形式保存到本地存储，在用户下次访问页面时，之前的设置将被还原
        this.onunload = function () {
            localStorage['connect:input'] = JSON.stringify(this.props);
        };
        // 清除本地存储的input键，并且重新加在页面，这导致连接设置回到默认值
        this.clear = function () {
            localStorage.removeItem('connect:input');
            location.reload();
        };
    },
    // 视图函数view，ctrl是对象控制器controller，api是其他的依赖或者数据接口，整个视图返回的是一个js对象，描述一个虚拟DOM结构 
    view: function (ctrl, api) {
        return (
            {
                // 虚拟DOm对象描述，表示一个form表单，attrs用于设置表单元素的属性，其中包括设置class为"connect-form"，以及
                //设置onSubmit(表单点击提交按钮时触发)属性为阻止表单默认提交的行为(设置后表单点击按钮不会提交而是由其他代码处理)
                //  children是一个数组，包含了表单元素的子元素
                tag: "form", attrs: { class: "connect-form", onSubmit: "event.preventDefault()" }, children: [
                    {
                        // 表单子元素是div，div又包含了两个子元素，分别是H5和button
                        tag: "div", attrs: {}, children: [
                            // h5子元素为一个字符串，表明h5元素显示的文本内容就是字符串
                            { tag: "h5", attrs: {}, children: ["Connect to broker"] },
                            // 类型为button， 元素属性设置，分别是class设置为设置button为主要样式（css类型），元素向右浮动使元素
                            // 靠右显示, 类型为按钮无默认行为，当用户点击按钮时，会调用api.connect方法并将‘ctrl.props’作为参数传给该方法，按钮显示文字为“Connect”
                            // api.connect表示连接到服务器的操作。bind()用于创建一个新的函数，并将指定的对象作为函数的上下文this绑定给新函数
                            // { tag: "button", attrs: { class: "button-primary u-pull-right", type: "button", onclick: api.connect.bind(this, ctrl.props) }, children: ["Connect"] }
                            // 不能使用下边的函数来代替上边的函数。上边的代码onclick直接绑定了api.connect.bind函数，当按钮被点击时，会执行
                            // api.connect方法，执行实际的连接操作。而下边函数，在按钮被点击时，并没有实际调用api.connect方法，而是在匿名函数
                            // 中执行打印，并使用“api.connect.bind(this, ctrl.props);”创建了一个新的函数，但并没有调用该函数。如果希望调用，应该
                            // 将最后一句修改为api.connect.bind(this, ctrl.props)();
                            {
                                tag: "button", attrs: {
                                    class: "button-primary u-pull-right", type: "button", onclick: function () {
                                        console.log(ctrl.props);// 在控制台打印 ctrl.props 的值
                                        // 将api.connect函数绑定到this上下文,这里this是button，并将ctrl.props作为参数传给api.connect
                                        api.connect.bind(this, ctrl.props)();
                                        console.log(api);
                                    }
                                }, children: ["Connect"]
                            }

                        ]
                    },

                    {
                        // 表单子元素是div，class为row，包含很多子元素
                        tag: "div", attrs: { class: "row" }, children: [
                            {
                                // 子元素是div， class为"six columns"，子元素为一个标签和一个输入框
                                tag: "div", attrs: { class: "six columns" }, children: [
                                    // 子元素是label，for属性制订了关联的表单元素"hostInput"，以便点击标签时，焦点会自动聚焦到对应的输入框
                                    { tag: "label", attrs: { for: "hostInput" }, children: ["Host"] },
                                    {
                                        // 子元素是一个input元素，属性u-full-width（自定义css），指定输入框的类型为文本，placeholder: "some.domain.tld"
                                        // 设置输入框的占位符文本，在输入框为空时显示文本用于提示 ，设置唯一id为hostInput，设置输入框的值为获取的host值
                                        // onchange：指定元素的值发生变化时要执行的事件处理函数。m.withAttr是Mithril辅助函数，处理元素属性与数据绑定，第一个
                                        // 参数是要绑定的属性名。这里是value，第二个参数是一个回调函数或数据存储位置
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", placeholder: "some.domain.tld", id: "hostInput",
                                            value: ctrl.props.host,
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'host'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    { tag: "label", attrs: { for: "portInput" }, children: ["Port"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", placeholder: "8080", id: "portInput",
                                            value: ctrl.props.port,
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'port'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "one column" }, children: [
                                    { tag: "label", attrs: { for: "sslInput" }, children: ["SSL"] },
                                    {
                                        tag: "input", attrs: {
                                            type: "checkbox", id: "sslInput",
                                            // 将复选框的最终状态与ctrl中的ssl相连
                                            checked: ctrl.props.ssl,
                                            onclick: m.withAttr('checked', m.set(ctrl.props, 'ssl'))
                                        }
                                    },
                                    // 两个label 这是疑问点，不知道在哪里有其他设置
                                    // 知道了，是为了在css中设置checkbox的样式
                                    { tag: "label", attrs: { for: "sslInput" } }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    { tag: "label", attrs: { for: "cleanInput" }, children: ["Clean session"] },
                                    {
                                        tag: "input", attrs: {
                                            type: "checkbox", id: "cleanInput",
                                            checked: ctrl.props.clean,
                                            onclick: m.withAttr('checked', m.set(ctrl.props, 'clean'))
                                        }
                                    },
                                    { tag: "label", attrs: { for: "cleanInput" } }
                                ]
                            },
                            {
                                tag: "div", attrs: { class: "one column" }, children: [
                                    { tag: "label", attrs: { for: "reconnectInput" }, children: ["Reconnect"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", placeholder: "0", id: "reconnectInput",
                                            value: ctrl.props.reconnect,
                                            onchange: function () {
                                                m.withAttr('value', m.set(ctrl.props, 'reconnect'))
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },

                    {
                        tag: "div", attrs: { class: "row" }, children: [
                            {
                                tag: "div", attrs: { class: "four columns" }, children: [
                                    { tag: "label", attrs: { for: "clientInput" }, children: ["ClientId"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", id: "clientInput",
                                            value: ctrl.props.clientId,
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'clientId'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    { tag: "label", attrs: { for: "keepaliveInput" }, children: ["Keepalive"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", placeholder: "30", id: "keepaliveInput",
                                            value: ctrl.props.keepalive,
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'keepalive'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "three columns" }, children: [
                                    { tag: "label", attrs: { for: "unameInput" }, children: ["Username"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", placeholder: "", id: "unameInput",
                                            value: ctrl.props.username,
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'username'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "three columns" }, children: [
                                    { tag: "label", attrs: { for: "pwdInput" }, children: ["Password"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", placeholder: "", id: "pwdInput",
                                            value: ctrl.props.password,
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'password'))
                                        }
                                    }
                                ]
                            }
                        ]
                    },

                    {
                        tag: "div", attrs: { class: "row" }, children: [
                            {
                                tag: "div", attrs: { class: "nine columns" }, children: [
                                    { tag: "label", attrs: { for: "lwtTopic" }, children: ["Last-will topic"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", id: "lwtTopic",
                                            value: ctrl.props.will.topic,
                                            onchange: m.withAttr('value', m.set(ctrl.props.will, 'topic'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    { tag: "label", attrs: { for: "qosInput" }, children: ["QoS"] },
                                    {
                                        // 子元素是下拉选择框
                                        tag: "select", attrs: {
                                            class: "u-full-width", id: "qosInput",
                                            //Number的作用是将字符串转为数值类型
                                            onchange: m.withAttr('value', m.set(ctrl.props.will, 'qos', Number))
                                        }, children: [
                                            // 使用map方法来生成一个包含option元素的数组。map是对数组的每个元素进行遍历，并返回一个新的数组
                                            [0, 1, 2].map(function (el) {
                                                // 子元素的类型是option，设置值为el，
                                                // 判断el的值是否等于控制器中的qos的值，如果相等，那么select属性将设置为true，表示该选项为默认选中项
                                                // children: [el] 代表el的值作为文本内容方式放在option元素中
                                                return ({ tag: "option", attrs: { value: el, selected: el === ctrl.props.will.qos }, children: [el] });
                                            })
                                        ]
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "one column" }, children: [
                                    { tag: "label", attrs: { for: "lwtRetainInput" }, children: ["Retain"] },
                                    {
                                        tag: "input", attrs: {
                                            type: "checkbox", id: "lwtRetainInput",
                                            checked: ctrl.props.will.retain,
                                            onclick: m.withAttr('checked', m.set(ctrl.props.will, 'retain'))
                                        }
                                    },
                                    { tag: "label", attrs: { for: "lwtRetainInput" } }
                                ]
                            }
                        ]
                    },

                    { tag: "label", attrs: { for: "lwtMessage" }, children: ["Last-will Message"] },
                    {
                        // 子元素是textarea，创建一个可编辑的文本域，用户可以输入赋值粘贴编辑操作，当设置到大段文本或者多行文本时使用
                        tag: "textarea", attrs: {
                            class: "u-full-width", id: "lwtMessage",
                            value: ctrl.props.will.payload,
                            onchange: m.withAttr('value', m.set(ctrl.props.will, 'payload'))
                        }
                    },

                    { tag: "button", attrs: { class: "button", type: "button", onclick: ctrl.clear }, children: ["Clear"] }
                ]
            }
        );
    },
}


var ConnectedWidget = {
    // 组件的控制器函数，用于处理组件的逻辑部分。
    // 在这里，控制器函数接收一个名为app的参数，这个参数是整个应用的状态对象 
    controller: function (app) {
        if (!app.client)
            m.route('/')
    },
    // 组件的视图函数，用于返回要渲染的虚拟DOM元素
    // 在Mithril中，视图函数通常接收两个参数：第一个参数为组件的属性（props），第二个参数为组件所属的控制器。
    // 在这里，我们使用_占位符来表示没有使用的第一个参数（即组件的属性），而第二个参数为app，表示整个应用的状态对象。
    view: function (_, app) {
        return (
            {
                tag: "div", attrs: {}, children: [
                    {
                        tag: "div", attrs: {}, children: [
                            { tag: "h6", attrs: {}, children: ['... ' + app.clientId + '@' + app.host] },
                            {
                                tag: "button", attrs: { class: "button-primary u-pull-right", type: "button", onclick: app.disconnect }, children: [
                                    "Disconnect"
                                ]
                            }
                        ]
                    },

                    { tag: "h5", attrs: {}, children: ["Subscriptions"] },
                    // m.component,Mithril框架中的方法，用于创建一个组件的实例，并将其添加到视图中
                    m.component(SubscriptionList, { api: app }),
                    m.component(SubscriptionForm, { api: app }),

                    { tag: "h5", attrs: {}, children: ["Publish"] },
                    m.component(PublishForm, { api: app }),

                    { tag: "h5", attrs: {}, children: ["Messages"] },
                    m.component(Messages, { api: app })
                ]
            }
        );
    },
};


var SubscriptionForm = {
    controller: function (app) {
        this.props = {
            topic: '',
            qos: 0
        };
        this.subscribe = function (obj, event) {
            event.preventDefault();
            if (obj.topic)
                app.api.subscribe(obj);
        };
    },
    view: function (ctrl) {
        return (
            {
                tag: "form", attrs: { class: "subscribe-form", onSubmit: "event.preventDefault();" }, children: [
                    {
                        tag: "div", attrs: { class: "row" }, children: [
                            {
                                tag: "div", attrs: { class: "eight columns" }, children: [
                                    { tag: "label", attrs: { for: "topicInput" }, children: ["Topic"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", id: "hostInput",
                                            value: ctrl.props.topic,
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'topic'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    { tag: "label", attrs: { for: "qosInput" }, children: ["QoS"] },
                                    {
                                        tag: "select", attrs: {
                                            class: "u-full-width", id: "qosInput",
                                            onchange: m.withAttr('value', m.set(ctrl.props, 'qos', Number))
                                        }, children: [
                                            [0, 1, 2].map(function (el) {
                                                return ({ tag: "option", attrs: { value: el }, children: [el] });
                                            })
                                        ]
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    {
                                        tag: "button", attrs: {
                                            class: "button-primary u-pull-right", type: "button",
                                            onclick: ctrl.subscribe.bind(this, ctrl.props)
                                        }, children: [
                                            "Subscribe"
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        );
    }
};

var SubscriptionList = {
    view: function (ctrl, app) {
        app = app.api;
        return (
            {
                tag: "table", attrs: { class: app.subscriptions.length ? 'u-full-width subscription-list' : 'u-full-width subscription-list u-hide' }, children: [
                    {
                        tag: "thead", attrs: {}, children: [
                            {
                                tag: "tr", attrs: {}, children: [
                                    { tag: "th", attrs: {}, children: ["Topic"] },
                                    { tag: "th", attrs: {}, children: ["QoS"] },
                                    { tag: "th", attrs: {} }
                                ]
                            }
                        ]
                    },
                    {
                        tag: "tbody", attrs: {}, children: [
                            app.subscriptions.map(function (el) {
                                return ({
                                    tag: "tr", attrs: {}, children: [
                                        { tag: "td", attrs: {}, children: [el.topic] },
                                        { tag: "td", attrs: {}, children: [el.qos] },
                                        {
                                            tag: "td", attrs: {}, children: [
                                                {
                                                    tag: "button", attrs: {
                                                        class: "button", type: "button",
                                                        onclick: app.unsubscribe.bind(this, el.topic)
                                                    }, children: [
                                                        "Unsubscribe"
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                })
                            })
                        ]
                    }
                ]
            }
        );
    }
};

var PublishForm = {
    controller: function (app) {
        this.msg = {
            topic: '',
            qos: 0,
            retain: false,
            payload: ''
        };
        this.publish = function (msg) {
            if (msg.topic.length)
                app.api.publish(msg)
        };
    },
    view: function (ctrl) {
        return (
            {
                tag: "form", attrs: { class: "publish-form", onSumbit: "event.preventDefault();" }, children: [
                    {
                        tag: "div", attrs: { class: "row" }, children: [
                            {
                                tag: "div", attrs: { class: "seven columns" }, children: [
                                    { tag: "label", attrs: { for: "pwdInput" }, children: ["Topic"] },
                                    {
                                        tag: "input", attrs: {
                                            class: "u-full-width", type: "text", id: "pwdInput",
                                            value: ctrl.msg.topic,
                                            onchange: m.withAttr('value', m.set(ctrl.msg, 'topic'))
                                        }
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    { tag: "label", attrs: { for: "qosInput" }, children: ["QoS"] },
                                    {
                                        tag: "select", attrs: {
                                            class: "u-full-width", id: "qosInput",
                                            onchange: m.withAttr('value', m.set(ctrl.msg, 'qos', Number))
                                        }, children: [
                                            [0, 1, 2].map(function (el) {
                                                return ({ tag: "option", attrs: { value: el }, children: [el] });
                                            })
                                        ]
                                    }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "one column" }, children: [
                                    { tag: "label", attrs: { for: "lwtRetainInput" }, children: ["Retain"] },
                                    {
                                        tag: "input", attrs: {
                                            type: "checkbox", id: "lwtRetainInput",
                                            checked: ctrl.msg.retain,
                                            onclick: m.withAttr('checked', m.set(ctrl.msg, 'retain'))
                                        }
                                    },
                                    { tag: "label", attrs: { for: "lwtRetainInput" } }
                                ]
                            },

                            {
                                tag: "div", attrs: { class: "two columns" }, children: [
                                    { tag: "button", attrs: { class: "button-primary u-pull-right", type: "button", onclick: ctrl.publish.bind(this, ctrl.msg) }, children: ["Publish"] }
                                ]
                            }
                        ]
                    },

                    { tag: "label", attrs: { for: "message" }, children: ["Message"] },
                    {
                        tag: "textarea", attrs: {
                            class: "u-full-width", id: "message",
                            value: ctrl.msg.payload,
                            onchange: m.withAttr('value', m.set(ctrl.msg, 'payload'))
                        }
                    }
                ]
            }
        );
    },
};


var Messages = {
    view: function (ctrl, app) {
        app = app.api;
        return (
            {
                tag: "div", attrs: {}, children: [
                    app.messages.map(function (msg) {
                        return ({
                            tag: "div", attrs: {}, children: [
                                {
                                    tag: "div", attrs: { class: "row" }, children: [
                                        { tag: "div", attrs: { class: "eight columns" }, children: ["Topic: ", msg.topic] },
                                        { tag: "div", attrs: { class: "two columns" }, children: ["QoS: ", msg.qos] },
                                        { tag: "div", attrs: { class: "two columns" }, children: [msg.retained ? 'Retained' : ''] }
                                    ]
                                },
                                { tag: "pre", attrs: {}, children: [{ tag: "code", attrs: {}, children: [msg.payload] }] }
                            ]
                        }
                        );
                    })
                ]
            }
        );
    },
};