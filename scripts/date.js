
// Replace the getYear() with getFullYear()
Date.prototype.getYear = function() {
	return this.getFullYear();
};

Date.prototype.setYear = function(year) {
	return this.setFullYear(year);
}

Date.prototype.clone = function() {
	return new Date(this.valueOf());
};

Date.prototype.equals = function(date) {
	return (this.compareTo(date) === 0);
};

Date.prototype.addMilliseconds = function(value) {
	return new Date(this.getTime() + value);
};

Date.prototype.addSeconds = function(value) {
	return this.addMilliseconds(value * 1000);
};

Date.prototype.addMinutes = function(value) {
	return this.addMilliseconds(value * 60 * 1000);
};

Date.prototype.addHours = function(value) {
	return this.addMilliseconds(value * 60 * 60 * 1000);
};

Date.prototype.addDays = function(value) {
	var date = this.clone();
	date.setDate(date.getDate() + value);
	return date;
};

Date.prototype.addWeeks = function(value) {
	return this.addDays(7);
};

Date.prototype.addMonths = function(value) {
	var date = this.clone();
	date.setMonth(date.getMonth() + value);
	return date;
};

Date.prototype.addYears = function(value) {
	return this.addMonths(value * 12);
};

Date.prototype.clearTime = function() {
	this.setHours(0);
	this.setMinutes(0);
	this.setSeconds(0);
	this.setMilliseconds(0);
	return this;
};

Date.prototype.yyyymmdd = function() {

	return sprintf("%04d-%02d-%02d", this.getFullYear(), this.getMonth() + 1, this.getDate());
}

Date.prototype.isLeapYear = function() {
	var y = this.getFullYear();
	return (((y % 4 === 0) && (y % 100 !== 0)) || (y % 400 === 0));
};

Date.prototype.isWeekday = function() {
	switch (this.getDay()) {
		case 0:
		case 6:
			return false;
	}

	return true;
};

Date.prototype.getWeek = function() {
	var onejan = new Date(this.getFullYear(), 0, 1);
	return Math.ceil((((this - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

Date.prototype.getFirstDayOfWeek = function() {
	// return monday for now
	return 1;
}

Date.prototype.getShortMonthName = function() {
	var m = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
	return m[this.getMonth()];
}

Date.prototype.getMonthName = function() {
	var m = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
	return m[this.getMonth()];
}

Date.prototype.getShortDayName = function() {
	var d = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
	return d[this.getDay()];
}

Date.prototype.getDayName = function() {
	var d = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
	return d[this.getDay()];
}

Date.prototype.getFriendlyDate = function() {
	return sprintf("%s %d %s", this.getShortDayName(), this.getDate(), this.getShortMonthName());

}

