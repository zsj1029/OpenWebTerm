import 'dart:async';
import 'dart:convert';
import 'dart:io';
import '../cfg.dart';
import '../transform/bufferTrans.dart';

class Exchanger {
  //Guacd socket
  late Socket _sk;

  //Browser websocket
  late WebSocket _ws;

  //params of guacd connection
  late Map<String, String> guaCfg;

  late StreamSubscription _skSubs;

  get getGuaSk => this._sk;

  get getWs => this._ws;

  //create connection & start listen
  create(HttpRequest req, String guaAddr, {int guaPort: 4822}) async {
    Log.i("WS request ：${req.uri.queryParameters}");
    //handle & merge req params
    this.guaCfg = Map.from(GuaCfg);
    this.guaCfg.addEntries(req.requestedUri.queryParameters.entries);

    this._ws = await WebSocketTransformer.upgrade(req,
        protocolSelector: (protocols) => 'guacamole');
    this._sk = await Socket.connect(guaAddr, guaPort);
    this._start();
  }

  _skAdd(String data) async {
    print("SEND==>${data}");
    // try {
    _sk.add(utf8.encode(data));
    // await _sk.done;
    // } catch (e, s) {
    //   Log.e(data, e, s);
    //   stop();
    // }
  }

  //handle args
  _handleGuaArgs(String data) async {
    var argsArr = data.substring(0, data.indexOf(';')).split(',').map((e) {
      List<String> item = e.split('.');
      item.first = guaCfg[item.last] == null
          ? "0"
          : guaCfg[item.last]!.length.toString();
      item.last = guaCfg[item.last] ?? '';
      return item.join('.');
    });
    var argsStr = argsArr.join(',') + ';';
    _skAdd(argsStr);
    _skAdd(
        "4.size,${guaCfg['width']!.length}.${guaCfg['width']},${guaCfg['height']!.length}.${guaCfg['height']},${guaCfg['dpi']!.length}.${guaCfg['dpi']};");
    // _skAdd("5.audio,8.audio/L8,9.audio/L16;");
    _skAdd("5.image,10.image/jpeg,10.image/png,10.image/webp;");
  }

  _skDataHandle(String data) {
    print("RECV<==${data}");
    if (data.startsWith("4.args")) {
      this._handleGuaArgs(data);
    }
    //send guacd msg direct to ws
    this._ws.add(data);
  }

  _wsDataHandle(String data) {
    //rec ws msg direct to guaSocket
    _skAdd(data);
  }

  _errHandle(e, s) {
    this.stop();
    Log.e("Socket Or Websocket Error:", e, s);
  }

  _doneHandle() {
    // this.stop();
    Log.i("Socket & Websocket closed.");
  }

  //start service
  _start() async {
    // send connect msg to Guacd socket
    _skAdd("6.select,${guaCfg['protocol']?.length}.${guaCfg['protocol']};");
    // Uint8List => string & http package handler transform & data listener
    utf8.decoder.bind(_sk).transform(BufferTrans()).listen(
        (data) => _skDataHandle(data),
        onError: _errHandle,
        onDone: _doneHandle);
    _ws.listen((data) => _wsDataHandle(data),
        onError: _errHandle, onDone: _doneHandle);
  }

  //stop service
  stop() {
    _ws.close();
    _sk.close();
  }
}
