import 'dart:async';

StreamTransformer<String, String> BufferTrans() {
  StringBuffer buffStr = StringBuffer();

  return StreamTransformer.fromHandlers(handleData: (String str, slink) {
    str = buffStr.toString() + str;
    buffStr.clear();
    var list = str
        .split(';')
        .skipWhile((value) =>
            value == "rate=44100,channels=2" ||
            value == 'rate=22050,channels=2')
        .toList();
    var lastNode = list.removeLast();
    if (lastNode.isNotEmpty) buffStr.write(lastNode);

    if (list.isNotEmpty) slink.add(list.join(";") + ';');
  });
}
