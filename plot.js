// ---------------------------------------------------------------------------------------------------------------------
// Coord - coordinates constructor
// ---------------------------------------------------------------------------------------------------------------------

//function CoordFrom

function Coord(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
  this.set(x1, y1, x2, y2);
  
  Object.defineProperties(this, {
    'deltaX': {
      get: () => this.x2 - this.x1
    },
    'deltaY': {
      get: () => this.y2 - this.y1
    },
    'width': {
      get: () => Math.abs(this.x2 - this.x1)
    },
    'height': {
      get: () => Math.abs(this.y2 - this.y1)
    },
    'isInverterX': {
      get: () => this.x2 < this.x1
    },
    'isInverterY': {
      get: () => this.y2 < this.y1
    }
  });
}


Coord.prototype.toString = function () {
  return JSON.stringify(this);
};

Coord.prototype.fromString = function (str) {
  let obj = JSON.parse(str);
  this.set(obj.x1, obj.y1, obj.x2, obj.y2);
};

Coord.prototype.isValid = function () {
  return Number.isFinite(this.x1) &&
    Number.isFinite(this.y1) &&
    Number.isFinite(this.x2) &&
    Number.isFinite(this.y2) &&
    this.width > 0 &&
    this.height > 0;
};

Coord.prototype.copyFrom = function (coord) {
  this.set(coord.x1, coord.y1, coord.x2, coord.y2);
};

Coord.prototype.modify = function (dx1, dy1, dx2, dy2) {
  this.x1 += dx1;
  this.y1 += dy1;
  this.x2 += dx2;
  this.y2 += dy2;
};


Coord.prototype.set1 = function (x1, y1) {
  this.x1 = x1;
  this.y1 = y1;
};

Coord.prototype.set2 = function (x2, y2) {
  this.x2 = x2;
  this.y2 = y2;
};

Coord.prototype.set = function (x1, y1, x2, y2) {
  this.set1(x1, y1);
  this.set2(x2, y2);
};

Coord.prototype.setInd = function (index, value) {
  this.x1 = index === 0 ? value : this.x1;
  this.y1 = index === 1 ? value : this.y1;
  this.x2 = index === 2 ? value : this.x2;
  this.y2 = index === 3 ? value : this.y2;
};

Coord.prototype.getInd = function (index) {
  return [this.x1, this.y1, this.x2, this.y2][index]
};

// coord - в какую систему преобразовуем
// this - из какой системы
Coord.prototype.pointXToCoord = function (x, coord) {
  return coord.x1 + (x - this.x1) * coord.width / this.width;
};

Coord.prototype.pointYToCoord = function (y, coord) {
  return coord.y1 - (y - this.y2) * coord.height / this.height;
};

Coord.prototype.containPoint = function (x, y) {
  return !!((x >= this.x1) && (x <= this.x2) &&
    (y >= this.y1) && (y <= this.y2));
};

Coord.prototype.normalize = function () {
  let tmp;
  
  if (this.isInverterX) {
    tmp = this.x2;
    this.x2 = this.x1;
    this.x1 = tmp;
  }
  
  if (this.isInverterY) {
    tmp = this.y2;
    this.y2 = this.y1;
    this.y1 = tmp;
  }
};

Coord.prototype.dbg = function (prefix) {
  prefix = (prefix) ? (prefix + ': ') : '';
  console.log(prefix + this.constructor.name + '(x1=' + this.x1.toFixed(1) + ', y1=' + this.y1.toFixed(1) + '; x2=' + this.x2.toFixed(1) + ', y2=' + this.y2.toFixed(1));
};

Point = function (x, y) {
  this.set(x, y)
};

Point.prototype.set = function (X, Y) {
  this.x = X;
  this.y = Y;
}