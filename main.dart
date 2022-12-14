import 'dart:convert';
import 'dart:io';
import 'package:logger/logger.dart';
import 'package:path/path.dart' as path;
import 'cfg.dart';
import 'connection/exchanger.dart';
import 'transform/bufferTrans.dart';
import 'package:mime/mime.dart';

void main(List<String> args) async {
  var arg = args.asMap();

  var logger = Logger();
  try {
    var server = await HttpServer.bind('0.0.0.0', 8888);
    await for (HttpRequest req in server) {
      if (WebSocketTransformer.isUpgradeRequest(req)) {
        // var exchanger;
        // try {
        //   exchanger = await Exchanger()
        //     ..create(req, arg[0] ?? GuaAddr,
        //         guaPort: int.parse(arg[1] ?? GuaPort));
        //   continue;
        // } catch (e, s) {
        //   logger.e("Guacd or Websocket connect failed", e, s);
        //   exchanger.stop();
        // }

        print('~~~~~~~~~~WS client connected~~~~~~~~~~~~~~~~~~');
        print(req.uri.queryParameters);
        var width = req.uri.queryParameters['width'];
        var height = req.uri.queryParameters['height'];
        var dpi = req.uri.queryParameters['dpi'];
        var hostname = req.uri.queryParameters['hostname'];
        var port = req.uri.queryParameters['port'];
        var username = req.uri.queryParameters['uuu'] ?? '';
        username = utf8.decode(base64.decode(username));
        var password = req.uri.queryParameters['ppp'] ?? '';
        password = utf8.decode(base64.decode(password));
        var protocol = req.uri.queryParameters['protocol'];
        print(username);
        print(password);

        var ws = await WebSocketTransformer.upgrade(req,
            protocolSelector: (protocols) => 'guacamole');
        print(ws.runtimeType);
        var guacdAddr = arg[0] ?? "192.168.65.129";
        int guacdPort = int.parse(arg[1] ?? '4822');
        var guacdConfig = {
          // "enable-theming": "true",
          "create-drive-path": "false",
          "height": height,
          "force-lossless": "false",
          "width": width,
          "dpi": dpi,
          "port": port,
          "create-recording-path": "false",
          "username": username,
          "password": password,
          "font-size": "12",
          "color-scheme": "gray-black",
          "backspace": "",
          "terminal-type": "",
          "font-name": "menlo",
          // "font-name": "SourceHanSans",
          "hostname": hostname,
          // "hostname": "192.168.65.130",
          // "hostname": "192.168.65.129",
          "enable-drive": 'false',
          'security': 'any',
          "ignore-cert": "true",
          "enable-wallpaper": "false",
          "enable-theming": "false",
          "enable-font-smoothing": "true",
          "enable-full-window-drag": "true",
          "enable-desktop-composition": "true",
          "enable-menu-animations": "false",
          "disable-bitmap-caching": "false",
          "disable-offscreen-caching": "false",
          "disable-glyph-caching": 'false',
          "resize-method": "reconnect"
        };

        late Socket guacdSocket;
        try {
          guacdSocket = await Socket.connect(guacdAddr, guacdPort,
              timeout: Duration(seconds: 3));

          guacdSocket.add(utf8.encode("6.select,3.${protocol};"));
        } catch (e) {
          ws.close();
          logger.e(e);
          continue;
        }

        utf8.decoder.bind(guacdSocket).transform(BufferTrans()).listen(
            (guacdMsg) {
          print("~~~~~~guaca msg:" + guacdMsg);

          try {
            var opcode = guacdMsg
                .substring(0, guacdMsg.indexOf(';'))
                .split(',')
                .map((e) => e.split('.'));

            switch (opcode.first.last) {
              case "args":
                try {
                  guacdSocket.add(utf8.encode(
                      "4.size,${width?.length}.${width},${height?.length}.${height},${dpi?.length}.${dpi};"));

                  guacdSocket.add(utf8.encode(
                      "5.audio,${"audio/L8".length}.audio/L8,${"audio/L16".length}.audio/L16;"));
                  guacdSocket.add(utf8.encode("5.video;"));
                  guacdSocket.add(utf8.encode(
                      "5.image,${"image/jpeg".length}.image/jpeg,${"image/png".length}.image/png,${"image/webp".length}.image/webp;"));
                  guacdSocket.add(utf8.encode(
                      "8.timezone,${'Asia/Shanghai'.length}.Asia/Shanghai;"));
                  var connStr = "7.connect,13.VERSION_1_4_0";
                  opcode.forEach((element) {
                    if (element.last != 'args' &&
                        !element.last.contains('VERSION')) {
                      if (guacdConfig[element.last] == null) {
                        connStr += ",0.";
                      } else {
                        connStr += "," +
                            guacdConfig[element.last]
                                .toString()
                                .length
                                .toString() +
                            '.' +
                            guacdConfig[element.last].toString();
                      }
                    }
                  });
                  connStr += ';';
                  guacdSocket.add(utf8.encode(connStr));
                  logger.i(connStr);
                } catch (e) {
                  guacdSocket.close();
                  ws.close();
                  print(e);
                  print('guacd 断开连接');
                }
                break;
              case "ready":
                break;
              default:
                ws.add(guacdMsg);
                break;
            }
          } catch (e) {
            print("switch error:" + e.toString());
          }
        }, onError: (err) {
          ws.close();
          logger.e(err);
        }, onDone: () {
          guacdSocket.close();
          logger.i("guacd 连接关闭");
          ws.close();
        });

        ws.listen((msg) {
          try {
            // print(msg);
            guacdSocket.add(utf8.encode(msg));
          } catch (e) {
            print(e);
          }
        }, onError: (err, stack) {
          print("err:" + err);
          print("err msg:" + stack);
        }, onDone: () async {
          guacdSocket.close();
          print("close connect");
        });
      } else {
        try {
          var urlPath =
              'public${req.requestedUri.path.replaceAll('/', path.separator)}';
          if (!File(urlPath).existsSync()) {
            throw Exception("${req.requestedUri.path} is not found");
          }
          var mime = lookupMimeType(urlPath) ?? 'text/plain';
          List<String> contentType = mime.split('/');
          req.response.headers.contentType = ContentType(
              contentType.first, contentType.last,
              charset: contentType.first.contains(RegExp(r'(text|application)'))
                  ? 'utf-8'
                  : null);
          var stream = File(urlPath).openRead();
          await req.response.addStream(stream);
        } catch (e) {
          req.response.writeln(e);
          logger.e(e);
        }
        req.response.close();
      }
    }
  } catch (e, s) {
    Log.e("HttpServer Error:", e, s);
  }
}
