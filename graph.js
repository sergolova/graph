const COOKIE_LIFE = 7;
const CANVAS_PADDING = 30;

const CLR_VALID = "#FFF";          // input valid value color
const CLR_ERROR = "#db303a";       // input invalid value color
const ID_CANVAS_WIDTH = '#cnv-width';
const ID_CANVAS_HEIGHT = '#cnv-height';
const ID_CANVAS_SIZE = '#lbl-cnv-size';
const ID_CANVAS_DIV = '#cnv-div';
const ID_GRID_SIZE = '#grid-size';
const ID_GRID_LBL = '#lbl-grid-size';
const ID_FORMULA = '#formula';
const ID_FORMULA_VALID = '.formula-valid';
const ID_STEP = '#step';
const ID_CANVAS = '#cnv';

const ID_AXIS_X1 = '#axis-X-start';
const ID_AXIS_X2 = '#axis-X-end';
const ID_AXIS_Y1 = '#axis-Y-start';
const ID_AXIS_Y2 = '#axis-Y-end';

const ID_HELP = 'help';
const ID_HELP_LINE = 'help-line';
const ID_HELP_FUNC = 'help-func';
const ID_HELP_DESCR = 'help-descr';

var drawer;
var functions;

function onError(drw, err) {
	debug(err);
}

function createHelp() {
	let helpDiv = document.getElementsByClassName(ID_HELP)[0];
	let helpLine = document.getElementsByClassName(ID_HELP_LINE)[0];
	
	for (let i = 0; i < functions.count; i++) {
		let cln = helpLine.cloneNode(true);
		let helpFunc = cln.getElementsByClassName(ID_HELP_FUNC)[0];
		let helpDescr = cln.getElementsByClassName(ID_HELP_DESCR)[0];
		let fnc = functions.getKey(i);
		
		helpFunc.innerText = fnc.usr;
		helpDescr.innerText = fnc.dsc;
		helpFunc.setAttribute('title', fnc.js);
		cln.removeAttribute('hidden');
		helpDiv.appendChild(cln);
	}
}

// Событие при изменении параметров канвы.
// События от контролов разнесены на две функции из-за того, что при изменении размеров
// канвы всё изображение стирается и получается мерцание. Зачем лишний раз мерцать?!
function onInputResize() {
	let cnv = $(ID_CANVAS)[0];
	let div = $(ID_CANVAS_DIV)[0];
	let lbl = $(ID_CANVAS_SIZE)[0];
	
	// Вся канва
	let properties = window.getComputedStyle(cnv, null);
	let w = Number.parseInt(properties.width);
	let h = Number.parseInt(properties.height);
	drawer.canvasCoord.set(0, 0, w, h);
	
	// область графика
	drawer.graphCoord.set(
		drawer.canvasCoord.x1 + CANVAS_PADDING,
		drawer.canvasCoord.y1 + CANVAS_PADDING,
		drawer.canvasCoord.x2 - CANVAS_PADDING,
		drawer.canvasCoord.y2 - CANVAS_PADDING);

	
//	div.style.width = inpW.value + "px";
//	div.style.height = inpH.value + "px";
//	cnv.style.width = div.style.width;
//	cnv.style.height = div.style.height;
	
   lbl.innerText = `${w}\u00D7${h}`;
	 cnv.setAttribute("width", w);
	 cnv.setAttribute("height", h);

//	setCookie(ID_CANVAS_WIDTH, inpW.value, COOKIE_LIFE);
//	setCookie(ID_CANVAS_HEIGHT, inpH.value, COOKIE_LIFE);

	drawer.redrawTimeout(drawer, 0);
}

// Событие при изменении параметров графика
function onInput() {
	try {
		let inpGrid = $(ID_GRID_SIZE)[0];
		let lblGrid = $(ID_GRID_LBL)[0];
		let inpFormula = $(ID_FORMULA)[0];
		let inpStep = $(ID_STEP)[0];
		let inpX1 = $(ID_AXIS_X1)[0];
		let inpX2 = $(ID_AXIS_X2)[0];
		let inpY1 = $(ID_AXIS_Y1)[0];
		let inpY2 = $(ID_AXIS_Y2)[0];
		let lblFormulaValid = $(ID_FORMULA_VALID)[0];
		let axis = drawer.axisCoord;
		
		drawer.gridCount = Math.abs(+inpGrid.value);
		if (!Number.isFinite(drawer.gridCount) || drawer.gridCount < 0) {
			drawer.gridCount = Drawer.DEFAULT_GRID;
		}
		
		lblGrid.innerText = drawer.gridCount === 0 ? 'нет' : drawer.gridCount;
		
		drawer.formula = functions.correctFormula(inpFormula.value);
		try {
			{ // экранировка eval'a
				let x = 0;
				let y = eval(drawer.formula);
			}
			inpFormula.style.background = CLR_VALID;
			lblFormulaValid.setAttribute('hidden', '');
		} catch (e) {
			lblFormulaValid.innerText = e.message;
			lblFormulaValid.removeAttribute('hidden');
			lblFormulaValid.style.color = 'red';
			inpFormula.style.background = CLR_ERROR;
			drawer.formula=null;
		}

		drawer.axisCoord.x1 = +inpX1.value;
		inpX1.style.background = isValid(axis.x1) ? CLR_VALID : CLR_ERROR;
		axis.x1 = axis.x1 || 0;

		axis.x2 = +inpX2.value;
		inpX2.style.background = isValid(axis.x2) ? CLR_VALID : CLR_ERROR;
		axis.x2 = axis.x2 || 0;

		axis.y1 = +inpY1.value;
		inpY1.style.background = isValid(axis.y1) ? CLR_VALID : CLR_ERROR;
		axis.y1 = axis.y1 || 0;

		axis.y2 = +inpY2.value;
		inpY2.style.background = isValid(axis.y2) ? CLR_VALID : CLR_ERROR;
		axis.y2 = axis.y2 || 0;

		// сохраняем в куки
		setCookie(ID_GRID_SIZE, inpGrid.value, COOKIE_LIFE);
		setCookie(ID_FORMULA, inpFormula.value, COOKIE_LIFE);
		setCookie(ID_STEP, inpStep.value, COOKIE_LIFE);
		setCookie(ID_AXIS_X1, inpX1.value, COOKIE_LIFE);
		setCookie(ID_AXIS_X2, inpX2.value, COOKIE_LIFE);
		setCookie(ID_AXIS_Y1, inpY1.value, COOKIE_LIFE);
		setCookie(ID_AXIS_Y2, inpY2.value, COOKIE_LIFE);
	} catch (e) {
		debug('ошибка ввода данных: '+e.message);
	}

	drawer.redrawTimeout(300);
}

function isValid(value) {
	return isFinite(value);
}

function loadCookies() {
	// загружаем контролы
	try {
		let inpGrid = $(ID_GRID_SIZE)[0];
		let inpFormula = $(ID_FORMULA)[0];
		let inpStep = $(ID_STEP)[0];
		let inpX1 = $(ID_AXIS_X1)[0];
		let inpX2 = $(ID_AXIS_X2)[0];
		let inpY1 = $(ID_AXIS_Y1)[0];
		let inpY2 = $(ID_AXIS_Y2)[0];
		
/*		if (cookieExists(ID_CANVAS_WIDTH)) {
			inpW.value = getCookie(ID_CANVAS_WIDTH)
		}
		
		if (cookieExists(ID_CANVAS_HEIGHT)) {
			inpH.value = getCookie(ID_CANVAS_HEIGHT);
		}
		*/
		if (cookieExists(ID_GRID_SIZE)) {
			inpGrid.value = getCookie(ID_GRID_SIZE);
		}

		if ( cookieExists(ID_FORMULA ) ) {
			inpFormula.value = getCookie(ID_FORMULA);
		}

		if ( cookieExists(ID_STEP ) ) {
			inpStep.value = getCookie(ID_STEP);
		}

		if ( cookieExists(ID_AXIS_X1 ) ) {
			inpX1.value = getCookie(ID_AXIS_X1);
		}

		if ( cookieExists(ID_AXIS_X2 ) ) {
			inpX2.value = getCookie(ID_AXIS_X2);
		}

		if ( cookieExists(ID_AXIS_Y1 ) ) {
			inpY1.value = getCookie(ID_AXIS_Y1);
		}

		if ( cookieExists(ID_AXIS_Y2 ) ) {
			inpY2.value = getCookie(ID_AXIS_Y2);
		}

	} catch (err) {
		debug('cannot paste cookies! '+err.message);
	}
}


function loadPage() {
	functions = new Functions();
	createHelp();
	drawer = new Drawer('#cnv');
	drawer.onError = onError;
	loadCookies();
	onInputResize(); // <= redraw here
	onInput(); // <= redraw here
}

function debug(msg) {
	let lbl = $("#dbg");
	lbl[0].innerText = msg;
	console.log(msg);
}



