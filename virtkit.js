(function () {

VirtKit = {};

var CHAR_WIDTH   = 9;
var CHAR_HEIGHT  = 16;

var SHEET_WIDTH  = 32;
var SHEET_HEIGHT = 8;
var SHEET_MARGIN = 8;

var VGA_COLORS = [
  [0,   0,   0  ], // COLOR_BLACK
  [0,   0,   170], // COLOR_BLUE
  [0,   170, 0  ], // COLOR_GREEN
  [0,   170, 170], // COLOR_CYAN
  [170, 0,   0  ], // COLOR_RED
  [170, 0,   170], // COLOR_MAGENTA
  [170, 85,  0  ], // COLOR_BROWN
  [170, 170, 170], // COLOR_LIGHT_GREY
  [85,  85,  85 ], // COLOR_DARK_GREY
  [85,  85,  255], // COLOR_LIGHT_BLUE
  [85,  255, 85 ], // COLOR_LIGHT_GREEN
  [85,  255, 255], // COLOR_LIGHT_CYAN
  [255, 85,  85 ], // COLOR_LIGHT_RED
  [255, 85,  255], // COLOR_LIGHT_MAGENTA
  [255, 255, 85 ], // COLOR_LIGHT_BROWN
  [255, 255, 255]  // COLOR_WHITE
];

var COLOR_BLACK = 0;
var COLOR_BLUE = 1;
var COLOR_GREEN = 2;
var COLOR_CYAN = 3;
var COLOR_RED = 4;
var COLOR_MAGENTA = 5;
var COLOR_BROWN = 6;
var COLOR_LIGHT_GREY = 7;
var COLOR_DARK_GREY = 8;
var COLOR_LIGHT_BLUE = 9;
var COLOR_LIGHT_GREEN = 10;
var COLOR_LIGHT_CYAN = 11;
var COLOR_LIGHT_RED = 12;
var COLOR_LIGHT_MAGENTA = 13;
var COLOR_LIGHT_BROWN = 14;
var COLOR_WHITE = 15;

VirtKit.initialize = function (callback) {
  this.g = document.getElementById("term").getContext("2d");

  this.cols  = 80;
  this.rows = 25;

  this.buffer = new Uint16Array(this.cols * this.rows);
  this.clear();

  this.cursor_col   = 0;
  this.cursor_row   = 0;
  this.cursor_color = 0x0f;

  this.font_sheets = new Array(256);

  var font_sheet = new Image();
  font_sheet.src = "font_sheet.png";

  font_sheet.addEventListener("load", (function () {
    this.generate_sheets(font_sheet);
    this.paint();

    if (typeof callback === 'function') {
      callback();
    }
  }).bind(this));
};

VirtKit.generate_sheets = function (image) {
  this.g.drawImage(image, 0, 0);

  var width  = SHEET_WIDTH  * CHAR_WIDTH  + (2 * SHEET_MARGIN);
  var height = SHEET_HEIGHT * CHAR_HEIGHT + (2 * SHEET_MARGIN);

  var pixels = this.g.getImageData(0, 0, width, height);

  for (var attribute = 0; attribute < 256; attribute++) {
    var bg = (attribute & 0xf0) >> 4;
    var fg =  attribute & 0x0f;

    var dest = this.g.createImageData(width, height);

    for (var i = 0; i < pixels.data.length; i += 4) {
      dest.data[i+3] = 255;

      if (pixels.data[i] < 128) {
        dest.data[i  ] = VGA_COLORS[bg][0];
        dest.data[i+1] = VGA_COLORS[bg][1];
        dest.data[i+2] = VGA_COLORS[bg][2];
      }
      else {
        dest.data[i  ] = VGA_COLORS[fg][0];
        dest.data[i+1] = VGA_COLORS[fg][1];
        dest.data[i+2] = VGA_COLORS[fg][2];
      }
    }

    this.font_sheets[attribute] = dest;
  }
};

VirtKit.paint = function () {
  this.g.fillStyle = "#000";
  this.g.fillRect(0, 0, this.cols * CHAR_WIDTH, this.rows * CHAR_HEIGHT);

  for (var row = 0; row < this.rows; row++) {
    for (var col = 0; col < this.cols; col++) {
      var ch = this.buffer[row * this.cols + col];

      var attribute = (ch & 0xff00) >> 8;

      ch &= 0xff;

      var sx = ( ch % SHEET_WIDTH     ) * CHAR_WIDTH  + SHEET_MARGIN;
      var sy = ((ch / SHEET_WIDTH) | 0) * CHAR_HEIGHT + SHEET_MARGIN;
      var dx = col * CHAR_WIDTH  - sx;
      var dy = row * CHAR_HEIGHT - sy;

      this.g.putImageData(
        this.font_sheets[attribute],
        dx, dy,
        sx, sy, CHAR_WIDTH, CHAR_HEIGHT
      );
    }
  }
};

VirtKit.clear = function () {
  for (var i = 0; i < this.cols * this.rows; i++) {
    this.buffer[i] = (this.cursor_color << 8) | 0x20; // space
  }

  this.cursor_col = 0;
  this.cursor_row = 0;
};

VirtKit.scroll = function () {
  // Shift everything one line back.
  for (var y = 1; y < this.rows; y++) {
    for (var x = 0; x < this.cols; x++) {
      var index = y * this.cols + x;
      this.buffer[index - this.cols] = this.buffer[index];
    }
  }

  // Clear last line.
  for (var x = 0; x < this.cols; x++) {
    this.buffer[this.cols * (this.rows - 1) + x] = 0x0f20;
  }
};

VirtKit.newline = function () {
  // Clear to end of line.
  while (this.cursor_col < this.cols)
  {
    this.buffer[this.cols * this.cursor_row + this.cursor_col] =
      (this.cursor_color << 8) | 0x20;
    this.cursor_col++;
  }

  // Go to next line, scrolling if necessary.
  this.cursor_col = 0;
  if ( ++this.cursor_row === this.rows )
  {
    this.scroll();
    this.cursor_row--;
  }
};

VirtKit.put_char = function (c) {
  switch (c) {
  case 0xA: // newline
    this.newline();
    break;
  default:
    this.buffer[this.cursor_row * this.cols + this.cursor_col] =
      (this.cursor_color << 8) | (c & 0xff);
    if (++this.cursor_col === this.cols) {
      this.newline();
    }
  }
};

VirtKit.write_string = function (str) {
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);

    // Represent chars out of range with a question mark.
    if (code >= 256) {
      code = 0x3f;
    }

    VirtKit.put_char(code);
  }
};

VirtKit.set_color = function (fg, bg) {
  this.cursor_color = (bg << 4) | fg;
};

window.addEventListener("load", function () {
  VirtKit.initialize(function () {

    VirtKit.set_color(COLOR_WHITE, COLOR_RED);
    VirtKit.clear();

    VirtKit.set_color(COLOR_RED, COLOR_WHITE);
    VirtKit.write_string("Kit Version 0.1\n");

    VirtKit.set_color(COLOR_LIGHT_GREY, COLOR_BLACK);
    VirtKit.paint();

    setInterval(function() {
      VirtKit.write_string("time = " + new Date() + "\n");
      VirtKit.paint();
    }, 1000);

  });
});

})();
