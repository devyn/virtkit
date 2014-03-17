(function () {

if (typeof VirtKit === 'undefined') VirtKit = {};

var CHAR_WIDTH   = 9;
var CHAR_HEIGHT  = 16;

var SHEET_WIDTH  = 32;
var SHEET_HEIGHT = 8;
var SHEET_MARGIN = 0;

var VGA_COLORS = [
  [0,   0,   0  ], // Color.BLACK
  [0,   0,   170], // Color.BLUE
  [0,   170, 0  ], // Color.GREEN
  [0,   170, 170], // Color.CYAN
  [170, 0,   0  ], // Color.RED
  [170, 0,   170], // Color.MAGENTA
  [170, 85,  0  ], // Color.BROWN
  [170, 170, 170], // Color.LIGHT_GREY
  [85,  85,  85 ], // Color.DARK_GREY
  [85,  85,  255], // Color.LIGHT_BLUE
  [85,  255, 85 ], // Color.LIGHT_GREEN
  [85,  255, 255], // Color.LIGHT_CYAN
  [255, 85,  85 ], // Color.LIGHT_RED
  [255, 85,  255], // Color.LIGHT_MAGENTA
  [255, 255, 85 ], // Color.LIGHT_BROWN
  [255, 255, 255]  // Color.WHITE
];

var CURSOR_BLINK_RATE = 270; // seems similar to QEMU but I didn't time it

VirtKit.Terminal =
function (canvas) {
  this.g = canvas.getContext("2d");

  this.cols = 80;
  this.rows = 25;

  this.buffer = new Uint16Array(this.cols * this.rows);

  this.cursor_col   = 0;
  this.cursor_row   = 0;
  this.cursor_color = 0x0f;
  this.cursor_on    = false;

  this.font_sheets = new Array(256);
};

var Color =
VirtKit.Terminal.Color = {
  BLACK: 0,
  BLUE: 1,
  GREEN: 2,
  CYAN: 3,
  RED: 4,
  MAGENTA: 5,
  BROWN: 6,
  LIGHT_GREY: 7,
  DARK_GREY: 8,
  LIGHT_BLUE: 9,
  LIGHT_GREEN: 10,
  LIGHT_CYAN: 11,
  LIGHT_RED: 12,
  LIGHT_MAGENTA: 13,
  LIGHT_BROWN: 14,
  WHITE: 15
}

VirtKit.Terminal.prototype.load_resources =
function (callback) {
  var font_sheet = new Image();
  font_sheet.src = url("/images/font_sheet.png");

  font_sheet.addEventListener("load", (function () {
    this.generate_sheets(font_sheet);
    this.clear();

    this.cursor_interval = setInterval((function () {
      this.toggle_cursor();
    }).bind(this), CURSOR_BLINK_RATE);

    if (typeof callback === 'function') {
      callback();
    }
  }).bind(this));
};

VirtKit.Terminal.prototype.generate_sheets =
function (image) {
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

VirtKit.Terminal.prototype.paint =
function () {
  this.g.fillStyle = "#000";
  this.g.fillRect(0, 0, this.cols * CHAR_WIDTH, this.rows * CHAR_HEIGHT);

  for (var row = 0; row < this.rows; row++) {
    for (var col = 0; col < this.cols; col++) {
      this.paintAt(col, row);
    }
  }
};

VirtKit.Terminal.prototype.paintAt =
function (col, row) {
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

  if (row === this.cursor_row && col === this.cursor_col && this.cursor_on) {
    this.g.fillStyle = "rgb(" +
      VGA_COLORS[this.cursor_color & 0x0f].join(",") + ")";

    this.g.fillRect(
      this.cursor_col * CHAR_WIDTH,
      this.cursor_row * CHAR_HEIGHT + CHAR_HEIGHT - 2,
      CHAR_WIDTH, 2
    );
  }
};

VirtKit.Terminal.prototype.toggle_cursor =
function () {
  this.cursor_on = !this.cursor_on;
  this.paintAt(this.cursor_col, this.cursor_row);
};

VirtKit.Terminal.prototype.clear =
function () {
  for (var i = 0; i < this.cols * this.rows; i++) {
    this.buffer[i] = (this.cursor_color << 8) | 0x20; // space
  }

  this.cursor_col = 0;
  this.cursor_row = 0;

  this.paint();
};

VirtKit.Terminal.prototype.scroll =
function () {
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

  this.paint();
};

VirtKit.Terminal.prototype.newline =
function () {
  // Prevent cursor from interfering.
  var cursor_on = this.cursor_on;

  this.cursor_on = false;

  // Clear to end of line.
  while (this.cursor_col < this.cols)
  {
    this.buffer[this.cols * this.cursor_row + this.cursor_col] =
      (this.cursor_color << 8) | 0x20;

    this.paintAt(this.cursor_col, this.cursor_row);

    this.cursor_col++;
  }

  this.cursor_on = cursor_on;

  // Go to next line, scrolling if necessary.
  this.cursor_col = 0;
  if ( ++this.cursor_row === this.rows )
  {
    this.scroll();
    this.cursor_row--;
  }
};

VirtKit.Terminal.prototype.put_char =
function (c) {
  switch (c) {
  case 0xA: // newline
    this.newline();
    break;
  case 0xD: // carriage return
    var old_col = this.cursor_col;

    this.cursor_col = 0;

    this.paintAt(old_col,         this.cursor_row);
    this.paintAt(this.cursor_col, this.cursor_row);
    break;
  default:
    this.buffer[this.cursor_row * this.cols + this.cursor_col] =
      (this.cursor_color << 8) | (c & 0xff);

    this.paintAt(this.cursor_col++, this.cursor_row);

    if (this.cursor_col === this.cols) {
      this.newline();
    }
    else {
      this.paintAt(this.cursor_col, this.cursor_row);
    }
  }
};

VirtKit.Terminal.prototype.write_string =
function (str) {
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);

    // Represent chars out of range with a question mark.
    if (code >= 256) {
      code = 0x3f;
    }

    this.put_char(code);
  }
};

/**
 * This method accepts either (fg, bg) as 4 bits each, or just (attribute) as an
 * 8-bit VGA attribute.
 */
VirtKit.Terminal.prototype.set_color =
function (fg, bg) {
  this.cursor_color = (bg << 4) | fg;
  this.paintAt(this.cursor_col, this.cursor_row);
};

})();
