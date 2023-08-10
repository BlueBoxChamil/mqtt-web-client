<!--
 * @Author: BlueBoxChamil
 * @Date: 2023-08-10 15:06:17
 * @LastEditTime: 2023-08-10 15:54:31
 * @FilePath: \README.md
 * @Description: 
 * Copyright (c) 2023 by BlueBoxChamil, All Rights Reserved. 
-->
# mqtt网页客户端

### 时间
20230810

### 目的
了解并且熟悉mqtt客户端的使用流程，并属性一下前端的动态界面

### 流程
1. 将EMQX5.1.2安装到香橙派，作为mqtt的服务端。在电脑下载mqttx客户端作为mqtt的客户端。同时开启两个客户端，连接服务器，并订阅相同的主题。经测试，在某一个客户端使用该主题进行发送时，另外一个客户端也能接受到信息。此时，客户端使用的端口号均为适用mqtt协议的1883。
2. 因为客户端和服务器都使用的是同一公司的软件，为了避免不兼容性，因此在esp32上搭建了一个mqtt客户端。经测试，esp32上也可以做到mqtt信息正常的收发。此时，esp3上使用的端口号是1883。
3. 在EMQX，即mqtt服务器添加mysql数据库，来作为用户登录验证，mqsql数据库使用Navicat Premium 16来操作数据。
4. 使用mqttx的网页端来对连接mqtt服务器。经测试，需要将服务器地址由“mqttx://”改为“ws://”,端口号由1883改为8083。虽然修改了很多，但只要订阅相同的主题，网页端的mqtt客户端也依旧可以正常收发数据。
5. 在 github上找到一个项目，是由Mithril和paho库合成的一个lib库，界面精美，也可以正常连接服务器使用。后续主要对动态界面进行学习。
6. 目前掌握流程图 [label](测试流程图.pdf)

### 存在问题

1. 因为使用的是免费版本，mysql只能作为一个用户登录验证，无法将mqtt流中的数据存入。
2. 使用的不是一个单独的js库，而是自己合成的，这部分难度比较大，暂时不看