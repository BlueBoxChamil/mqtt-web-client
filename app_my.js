/*
 * @Author: BlueBoxChamil
 * @Date: 2023-07-27 14:11:36
 * @LastEditTime: 2023-08-02 17:06:12
 * @FilePath: \app_my.js
 * @Description: 这个文件负责初始化和配置整个应用程序。他通常包含路由，全局状态的管理以及
 * 将组件渲染到页面中的逻辑
 * Copyright (c) 2023 by BlueBoxChamil, All Rights Reserved. 
 */
// 

var App = {
  messages: [],
  subscriptions: [],
};

// App组件中自定义一个connect函数
App.connect = function (args) {
  //创建一个新的MqttClient实例，并将其赋值给App.client属性
  //在点击“CONNECT”按钮时，把ctrl.props作为参数传来赋值给arg，然后再解析
  App.client = new MqttClient(args);
  console.log("App.client");
  console.log(App.client);
  console.log("App.client");

  App.client
    .on('connect', function () {
      console.info('connected to ' + App.client.broker.host + ':' + App.client.broker.port + ' as ' + App.client.broker.clientId);
      m.route('/connected');
    })
    .on('disconnect', function () {
      console.info(App.client.broker.clientId + ' disconnected');
      App.subscriptions = [];
      m.route('/');
    })
    // 设置一个时间监听器，用于监听connecting事件
    .on('connecting', console.info.bind(console, 'connecting to ' + App.client.broker.host + ':' + App.client.broker.port))
    .on('offline', console.info.bind(console, App.client.broker.clientId + ' is offline'))
    .on('message', function (topic, payload, message) {
      console.log('got message ' + topic + ' : ' + payload);
      App.messages.push({
        topic: topic,
        payload: payload,
        qos: message.qos,
        retained: message.retained,
      });
      m.redraw();
    })
    .connect();
  const listeners = App.client.getListeners();
  console.log("App.client again");
  console.log(listeners);

  console.log(App.client);
  console.log("App.client again");

  // expose functionality and data to views
  // 将mqtt代理的主机信息赋值给App.host
  App.host = App.client.broker.host;
  // 将mqtt客户端ID赋值给App.clientId
  App.clientId = App.client.broker.clientId;
  // 将MQTT客户端的disconnect方法赋值给App.disconnect。这表明MqttClient有一个名为disconnect的方法，
  // 用于手动与代理断开连接。
  App.disconnect = App.client.disconnect;
  // 定义一个名为subscribe的函数，用于让视图订阅MQTT主题。该函数接受一个param对象，
  // 其中应包含订阅主题和所需的服务质量（QoS）等级。
  App.subscribe = function (param) {
    App.client.subscribe(param.topic, param.qos, function (error, granted) {
      if (error) {
        console.error('Error subscribing to ' + param.topic, error);
      } else {
        console.info('subscribed to ' + param.topic + ' with QoS ' + param.granted);
        App.subscriptions.push({ topic: param.topic, qos: granted });
      }
      m.redraw();
    });
  };

  App.unsubscribe = function (topic) {
    App.client.unsubscribe(topic, function (error, reply) {
      if (error) {
        console.error('Error unsubscribing from ' + topic, error);
      } else {
        console.info('unsubscribed from ' + topic);
        App.subscriptions = App.subscriptions.filter(function (elem) {
          return elem.topic !== topic;
        });
      }
      m.redraw();
    });
  };

  App.publish = function (param) {
    App.client.publish(param.topic, param.payload, param, function () { console.log('Published', param); });
  };
};


m.route.mode = 'hash';
// 使用 Mithril 的路由功能来配置应用程序的路由和视图
/* 第一个参数来获取id为content的元素，这个元素将成为路由渲染视图的容器
   第二个参数是默认路由路径，我们将默认路由设置为“/”，意味着当应用程序的URL不匹配任何其他定义的路由时，将显示与
   “/”关联的组件
   第三个参数是一个对象，其中键是路由路径，值是要在该路径下渲染的组件

    {
  '/': m(ConnectForm, { connect: App.connect }, App),}
  这是定义在根目录下由“/”下要渲染的组件部分
  ConnectForm：是一个自定义的组件，在另外一个js文件中定义
  { connect: App.connect }是传递给ConnectForm组件的属性对象
}

*/
m.route(document.getElementById('content'), '/', {
  '/': m(ConnectForm, { connect: App.connect }, App),
  '/connected': m(ConnectedWidget, App),
});
