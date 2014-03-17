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

    terminal.set_color(Color.DARK_GREY, Color.BLACK);
    terminal.write_string("Note: not actually doing anything yet, so just\n" +
      "type stuff once you see the login prompt.\n");
    terminal.set_color(Color.LIGHT_GREY, Color.BLACK);

    setTimeout(function () {
      terminal.write_string("\nLogin: ");

      window.addEventListener("keypress", function (e) {
        e.preventDefault();

        var code = e.keyCode || e.which;

        if (code >= 0x20 && code <= 0x7e) {
          // printable chars
          terminal.put_char(code);
        }
        else if (code === 0xd) {
          // 0xd = enter key, so put newline
          terminal.put_char(0xa);
        }
      });
    }, 1000);

  });

});

})();
