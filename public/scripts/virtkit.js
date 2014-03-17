(function () {

if (typeof VirtKit === 'undefined') VirtKit = {};

window.addEventListener("load", function () {
  var Color = VirtKit.Terminal.Color;

  terminal = new VirtKit.Terminal(document.getElementById("term"));
  
  terminal.load_resources(function () {

    terminal.set_color(Color.LIGHT_GREY, Color.BLACK);
    terminal.clear();

    terminal.set_color(Color.RED, Color.WHITE);
    terminal.write_string("VirtKit Simulator\n");

    terminal.set_color(Color.LIGHT_GREY, Color.BLACK);

    terminal.write_string("\nOpening new session on " +
      (window.location.host || "localhost") + "...\n");

    var socket = new WebSocket("ws://" +
      (window.location.host || "localhost") + "/");

    socket.addEventListener("open", function () {
      socket.addEventListener("message", function (e) {
        terminal.write_string(e.data);
      });

      window.addEventListener("keypress", function (e) {
        e.preventDefault();

        var code = e.keyCode || e.which;

        if (code >= 0x20 && code <= 0x7e) {
          // printable chars
          socket.send(String.fromCharCode(code));
        }
        else if (code === 0xd) {
          // 0xd = enter key, so put newline
          socket.send("\n");
        }
      });

      window.addEventListener("keydown", function (e) {
        var code = e.keyCode || e.which;

        if (code === 0x8) {
          e.preventDefault();

          // 0x8 = backspace
          socket.send("\x08");
        }
      });
    });

    socket.addEventListener("close", function () {
      terminal.set_color(Color.DARK_GREY, Color.BLACK);
      terminal.write_string("\nConnection closed.\n");
    });

  });

});

})();
