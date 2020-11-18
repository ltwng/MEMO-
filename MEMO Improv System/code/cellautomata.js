/*****
*	This code creates a cellular automata
*	Using variable GOL rules, modified for a value increment/decrement mode
*	Dillon Bastan 2018
******/



/************************************************************/
/**********************  GLOBALS/INIT  **********************/

//IO
inlets = 1;
outlets = 1;
//mgraphics
mgraphics.init();
mgraphics.relative_coords = 1;
mgraphics.autosketch = 0;
mgraphics.autofill = 0;
//
var gridDim = [8, 8];
var run = 0;
var nstep = gridDim[0] * gridDim[1];
var step = 0;
var padding = 0.01;
//Objects
var grid = new Grid( gridDim[0], gridDim[1] );	//Class for holding cells
//colors
var col_cellBorn = [0.427, 0.843, 1.];
var col_cell = [1., 0.71, 0.196];
var col_background = [0.157, 0.157, 0.157, 1.];
/************************************************/




/*********************************************************/
/**********************  MAIN/DRAW  **********************/

//
function bang() {
	//Calculate new cell values by applying rules
	if (run)
		grid.getNewGrid();
	//Call the paint function, which displays objects
	mgraphics.redraw();
	//Output cell values
	outputParameters( grid );
}

//
function paint() {
	with (mgraphics) {
		//Background
		set_source_rgba( col_background );
		rectangle(-1, 1, 2, 2);
		fill();
	}
	//Display the cells
	grid.display( padding );
	//Display active step
	displayStep();
}

//
function displayStep() {
	var w = 1 / gridDim[0];
	var h = 1 / gridDim[1];
	var y = ( ((step%gridDim[1]) + 1) / gridDim[1] ) * 2 - 1;
	var x = Math.floor( step/(gridDim[1]) ) * w * 2 - 1;
	w = w*2 - padding;
	h = h*2 - padding;
	//
	with( mgraphics ) {
		set_source_rgba( 1, 1, 1, 0.3 );
		rectangle( x, y, w, h );
		fill();
	}
}

/************************************************/




/********************************************************/
/**********************  FUNCTIONS  **********************/

//Set grid dimensions
function dim(ncol, nrow) {
	gridDim = [ncol, nrow];
	nstep = gridDim[0] * gridDim[1];
	grid.set_dim( gridDim );
	//Redraw
	mgraphics.redraw();
	//Output cell values
	outputParameters( grid );
}

//Run the cellular automaton
function set_run(v) {
	run = v;
}

//Set the tonic for quantized pitch output
function set_step(v) {
	step = v;
	//Redraw canvas
	mgraphics.redraw();
}

//Rules to activate a cell
function born(lo, hi) {
	grid.set_rulesBorn( [lo, hi] );
}

//Rules to deactivate a cell
function survive(lo, hi) {
	grid.set_rulesSurvive( [lo, hi] );
}

//Set whether lifes are on/off or increment/decrement
function booleanLife(v) {
	grid.set_booleanLife( v );
}

//Rules to deactivate a cell
function increment( v ) {
	grid.set_incScale( v );
}

//Output a list of cell values
function outputParameters( grid, isScaled ) {
	var cellValues = grid.getValues_1d( isScaled );
	outlet( 0, cellValues );
}

//Convert (0-1) values to quantized pitches
function getQuantizedValues( values, tonic, mode, octaveRange ) {
	for (var i = 0; i < values.length; i++) {
		//
		var value = values[i];
		if ( value > 0.0001 ) {
			//To octave range based on MIDI pitch (0-127)
			value = value*octaveRange[1] + octaveRange[0];
			//Check if quant is on
			if (mode !== -1) {
				//To Chromatic
				value = Math.round( value );
				//Quantize to a mode (scale down)
				if (mode > 0)
					value = ( value*0.5826*12 ) / 7 + tonic;
			}
			//MTOF
			value = Math.pow(2, (value-69) / 12) * 440;
			value = Math.min( Math.max( value, 20), 13000 );
		} else
			value = 0;
		values[i] = value;
	}
	return values;
}

/************************************************/




/********************************************************/
/*********************  INTERFACE  ************************/

//Mouse click
function onclick(x, y, button, cmd, shift) {
	//If shift down, clear cell, otherwise random value
	var value = (shift)? 0 : Math.random();
	//Set cell value under mouse
	setCellValueFromMouse(x, y, value);
	//Call the paint function, which displays objects
	mgraphics.redraw();
	//Output cell values
	outputParameters( grid );
}
onclick.local = 1;


//Mouse Drag
function ondrag(x, y, button, cmd, shift) {
	//Determine if mouse release
	if (button === 0) {
		return;
	}
	//If shift down, clear cell, otherwise random value
	var value = (shift)? 0 : Math.random();
	//Set cell value under mouse
	setCellValueFromMouse(x, y, value);
	//Call the paint function, which displays objects
	mgraphics.redraw();
	//Output cell values
	outputParameters( grid );
}
ondrag.local = 1;


//Set cell value based on xy mouse coordinate
function setCellValueFromMouse( x, y, value ) {
	//Get cell location of xy
	var cell = [ 
		Math.min( Math.max( Math.floor(x/mgraphics.size[0] * gridDim[0]), 0), gridDim[0]-1 ), 
		Math.min( Math.max( Math.floor((1 - y/mgraphics.size[1]) * gridDim[1]), 0), gridDim[1]-1 )
	];
	//
	grid.grid[ cell[0] ][ cell[1] ].setValue( value );
	grid.grid[ cell[0] ][ cell[1] ].saveValue();
}

/********************************************************/




/********************************************************/
/*********************  CLASSES  ************************/


//Class for applying rules to cells
function Grid( ncol, nrow ) {
	//Members
	this.nrow = nrow;
	this.ncol = ncol;
	this.grid = [];
	this.rulesBorn = [3, 6];
	this.rulesSurvive = [2, 3];
	this.booleanLife = 0;
	this.incScale = 0.1;
	
	//initialize grid of cells
	for (var col = 0; col < this.ncol; col++) {
		this.grid[col] = [];
		for (var row = 0; row < this.nrow; row++) {
			this.grid[col][row] = new Cell( col, row, 0 );
		}
	}
	
	//Calculate new cell values based on rules
	this.getNewGrid = function() {
		for (var col = 0; col < this.ncol; col++) {
			for (var row = 0; row < this.nrow; row++) {
				//Get the number of active neighbors and their value sum
				//Active neighbors are cells with a value greator than zero
				var neighborData = this.getNeighborData( col, row );
				var num = neighborData[0];
				var sum = neighborData[1];
				var val = this.grid[col][row].value;
				//
				var newVal = this.applyRules( val, num, sum );
				this.grid[col][row].setValue( newVal );
			}
		}
		//Save new values
		this.saveState();
	}
	
	//Apply rules to a value based on neighbors and current value
	this.applyRules = function( value, neighborNum, neighborSum ) {
		var state = value > 0;
		//Don't calculcate if no activity
		if ( !neighborNum && !state )
			return 0;
		//Vars
		var sum = neighborSum + value;
		var roundSum = Math.round( sum );
		var mean = sum / (neighborNum+1);
		var activeComp = ( this.booleanLife )? neighborNum : sum;	//Comparing vaues for rules
		var deactiveComp = ( this.booleanLife )? neighborNum : roundSum;
		//Apply the rules to the value in two ways ( activate/deactivate or activate/(increment+decrement)
		if (state) {	//If active
			if ( activeComp < this.rulesSurvive[0] || activeComp > this.rulesSurvive[1] ) {	//can't survive
				if ( this.booleanLife )	//deactivate
					value = 0;
				else
					value -= mean * this.incScale;	//decrement value
			} else {								//can survive
				if ( !this.booleanLife )
					value += Math.min( mean*this.incScale, 1 );	//increment
			}
		} else {		//If deactive
			if ( deactiveComp === this.rulesBorn[0] || deactiveComp === this.rulesBorn[1] ) {	//birth
				value = Math.random();//mean;
			}
		}
		//Constrain
		value = Math.min( Math.max( value, 0), 1 );
		//value = Math.max( value, 0);
		return value;
	}
	
	//Return info about the neighbors of a cell
	this.getNeighborData = function( indexCol, indexRow ) {
		//Number of active neighbors, sum of neighbors
		var num = 0;
		var sum = 0;
		//Loop through neighbors
		for (var c = -1; c <= 1; c++) {
        	for (var r = -1; r <= 1; r++) {
				//Skip if the same cell
            	if (r == 0 && c == 0) 
					continue;
				var col = c + indexCol;
				var row = r + indexRow;
				//Skip if out of bounds
				if ( !this.grid[col] || !this.grid[col][row] )
					continue;
				//Increment totals
				num += this.grid[col][row].value > 0;
				sum += this.grid[col][row].value;
        	}
    	}
		return [num, sum];
	}
	
	//Set the dimensions
	this.set_dim = function( dim ) {
		this.ncol = dim[0];
		this.nrow = dim[1];
		//initialize more cells if needed
		for (var col = 0; col < this.ncol; col++) {
			if ( !this.grid[col] )
				this.grid[col] = [];
			for (var row = 0; row < this.nrow; row++) {
				if ( !this.grid[col][row] )
					this.grid[col][row] = new Cell( col, row, 0 );
			}
		}
	}
	
	//Set the rules to activate a cell
	this.set_rulesBorn = function(rules) {
		this.rulesBorn = rules;
	}
	
	//Set the rules to deactivate a cell
	this.set_rulesSurvive = function(rules) {
		this.rulesSurvive = rules;
	}
	
	//If boolean life is on, rules are appliead as revive/survive/kill. 
	//If off, value will be incremented/decremented 
	this.set_booleanLife = function(v) {
		this.booleanLife = v;
	}
	
	//Set the scale of the increment/decrement value amount per frame
	this.set_incScale = function(v) {
		this.incScale = v;
	}
	
	//Save new cell values
	this.saveState = function() {
		for (var col = 0; col < this.ncol; col++) {
			for (var row = 0; row < this.nrow; row++) {
				this.grid[col][row].saveValue();
			}
		}
	}
	
	//
	this.getValues_1d = function( scaled ) {
		var values = [];
		var i = 0;
		for (var col = 0; col < this.ncol; col++) {
			for (var row = 0; row < this.nrow; row++) {
				var val = this.grid[col][row].value;
				values[i] = val;
				i++;
			}
		}
		return values;
	}
	
	//Display the cells
	this.display = function( padding ) {
		var wh = [ 1/this.ncol, 1/this.nrow ];
		var padwh = [ wh[0]*2-padding, wh[1]*2-padding ];
		for (var col = 0; col < this.ncol; col++) {
			for (var row = 0; row < this.nrow; row++) {
				this.grid[col][row].display( wh, padwh );
			}
		}
	}
}


//Class for cells that hold value
function Cell(x, y, value) {
	//members
	this.x = x;
	this.y = y;
	this.value = value;
	this.newValue = value;
	this.lifeState = 0;
	
	//
	this.setValue = function(value) {
		this.newValue = value;
	}
	
	//
	this.saveValue = function() {
		//Determine if just born
		this.lifeState = 0;
		if (this.value === 0) {
			if (this.newValue > 0)
				this.lifeState = 1;
		}
		//
		this.value = this.newValue;
	}
	
	//
	this.display = function( wh, padwh ) {
		with( mgraphics ) {
			//get color based on life state
			var col;
			if (this.lifeState === 1)	//birth
				col = col_cellBorn;
			else
				col = col_cell;
			//Scale alpha based on current value and peak value
			set_source_rgba( col, this.value );
			rectangle( 
				this.x*wh[0] * 2 - 1, (this.y+1)*wh[1] * 2 - 1, 
				padwh[0], padwh[1] 
			);
			fill();
		}
	}
}

/************************************************/




/********************************************************/
/*********************  UTILITY  ************************/

//
function forcesize(w, h) {
	if (w!=h) {
		h = w;
		box.size(w,h);
	}
}
forcesize.local = 1;

//
function onresize(w,h) {
	forcesize(w, h);
	mgraphics.redraw();
}
onresize.local = 1; 

//
function calcAspect() {
	var width = this.box.rect[2] - this.box.rect[0];
	var height = this.box.rect[3] - this.box.rect[1];
	return width/height;
}
onresize.local = 1; 