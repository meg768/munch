var sprintf    = require('yow/sprintf');
var isArray    = require('yow/isArray');
var isString   = require('yow/isString');
var isDate     = require('yow/isDate');
var isInteger  = require('yow/isInteger');
var yahoo      = require('yahoo-finance2').default;
var MySQL      = require('../scripts/mysql.js');

require('pushover-console');

var Module = new function() {

	var _db = undefined;
	var _argv = undefined;

	function debug() {
		console.log.apply(this, arguments);
	}

	function defineArgs(args) {

		args.option('symbol',    {alias: 's', describe:'Download specified symbol only'});
		args.option('days',      {alias: 'd', describe:'Specifies number of days back in time to fetch'});
		args.option('since',     {alias: 'c', describe:'Fetch quotes since the specified date'});
		args.option('from',      {alias: 'f', describe:'Fetch quotes from the specified date'});
		args.option('to',        {alias: 't', describe:'Fetch quotes to the specified date'});
		args.option('schedule',  {alias: 'x', describe:'Schedule job at specified cron date/time format'});
		args.option('pause',     {alias: 'p', describe:'Pause for number of seconds between batches', default:0});
		args.option('refresh',   {alias: 'r', describe:'Refresh statistics', default:false});
		args.help();

		args.wrap(null);

		args.check(function(argv) {

			if ((argv.from && !argv.to) || (!argv.from && argv.to))
				throw new Error('Must specify both --from and --to.');

			if (argv.days && argv.since)
				throw new Error('Cannot specify both --since and --days.');

			if (argv.days && !isInteger(argv.days)) {
				throw new Error(sprintf('Invalid number of days "%s".', argv.days));
			}

			if (argv.from) {
				if (!isDate(new Date(argv.from)))
					throw new Error(sprintf('Invalid date "%s".', argv.from));
			}

			if (argv.to) {
				if (!isDate(new Date(argv.to)))
					throw new Error(sprintf('Invalid date "%s".', argv.to));
			}


			if (argv.since) {
				if (!isDate(new Date(argv.since)))
					throw new Error(sprintf('Invalid date "%s".', argv.since));

			}

			return true;
		});

	}

	function dateToString(date) {
		if (!date)
			date = new Date();

		return sprintf('%04d-%02d-%02d', date.getFullYear(), date.getMonth() + 1, date.getDate());

	}


	async function updateStock(symbol) {


        function computeSMA(quotes, days) {
            if (quotes.length < days)
                return null;

            var sum = 0;

            for (var index = 0; index < days; index++) {
                sum += quotes[index].close;

            }

            return parseFloat((sum / days).toFixed(2));
        }

        function computeAV(quotes, days) {
            if (quotes.length < days)
                return null;

            var sum = 0;

            for (var index = 0; index < days; index++)
                sum += quotes[index].volume;

            return parseInt((sum / days).toFixed(0));
        }

        function computeWeekLow(quotes, weeks) {

            var days = weeks * 5;

            if (quotes.length < days)
                return null;

            var min = undefined;

            for (var index = 0; index < days; index++)
                min = (min == undefined) ? quotes[index].close : Math.min(min, quotes[index].close);

            return min;
        }

        function computeWeekHigh(quotes, weeks) {

            var days = weeks * 5;

            if (quotes.length < days)
                return null;

            var max = undefined;

            for (var index = 0; index < days; index++)
                max = (max == undefined) ? quotes[index].close : Math.max(max, quotes[index].close);

            return max;
        }

        function computeATR(quotes, days) {
            if (quotes.length < days + 1)
                return null;

            var sum = 0;

            for (var index = 0; index < days; index++) {

                var A = quotes[index].high - quotes[index].low;
                var B = Math.abs(quotes[index].low  - quotes[index+1].close);
                var C = Math.abs(quotes[index].high - quotes[index+1].close);

                sum += Math.max(Math.max(A, B), C);
            }

            return parseFloat((sum / days).toFixed(2));
        }

        async function getGeneralInformation(symbol) {

            function isValidName(name) {
                return typeof(name) == 'string' && name != 'n/a';
            }

            let query = {};
            query.sql = 'SELECT * FROM stocks WHERE ?? = ?';
            query.values = ['symbol', symbol];

            let stocks = await _db.query(query);
            let stock = stocks.length == 1 ? stocks[0] : {};

            if (stocks.length == 0) {
                throw new Error(`Symbol not ${symbol} not found.`);
            }

            console.log(`Fetching summary profile from Yahoo for symbol ${symbol}.`);

            let modules = ['price', 'summaryProfile', 'quoteType', 'assetProfile'];
            let summary = await yahoo.quoteSummary(symbol, {modules:modules});

            stock = {};

            stock.name = summary.price.longName ? summary.price.longName : summary.price.shortName;

            stock.sector = summary.assetProfile && isValidName(summary.assetProfile.sector) ?  summary.assetProfile.sector : '';
            stock.industry = summary.assetProfile && isValidName(summary.assetProfile.industry) ? summary.assetProfile.industry : '';
            stock.country = summary.assetProfile && isValidName(summary.assetProfile.country) ? summary.assetProfile.country : '';    

            stock.exchange = isValidName(summary.price.exchangeName) ? summary.price.exchangeName : '';
            stock.type = isValidName(summary.price.quoteType) ? summary.price.quoteType : ''; 

            return stock;
        }

        async function getStatistics(symbol) {

            let query = {};
            query.sql = 'SELECT * FROM quotes WHERE symbol = ? ORDER BY date DESC LIMIT ?';
            query.values = [symbol, 51 * 5];

            let quotes = await _db.query(query);
            let stats = {};

            if (quotes.length > 0) {
                stats.SMA200   = computeSMA(quotes, 200);
                stats.SMA50    = computeSMA(quotes, 50);
                stats.SMA20    = computeSMA(quotes, 20);
                stats.SMA10    = computeSMA(quotes, 10);
                stats.AV14     = computeAV(quotes, 14);
                stats.WL51     = computeWeekLow(quotes, 51);
                stats.WH51     = computeWeekHigh(quotes, 51);
                stats.ATR14    = computeATR(quotes, 14);
            }

            return stats;

        }

        let info = await getGeneralInformation(symbol);
        let stats = await getStatistics(symbol);

        let stock = {symbol:symbol, updated: new Date(), ...info, ...stats};

        await _db.upsert('stocks', stock);
	}

	async function getStartDates() {

		console.log('Fetching last quote dates...');

		let sql = 'SELECT symbol, MAX(date) as date FROM quotes GROUP BY symbol';
        let rows = await _db.query(sql);
        let dates = {};
        
        rows.forEach(function(row) {
            var date = new Date(row.date);
            date.setDate(date.getDate() + 1);

            dates[row.symbol] = date;
        });

        return dates;
	}


	async function deleteSymbol(symbol) {

		async function deleteFromStocks(symbol) {

            let query = {};
            query.sql = 'DELETE FROM ?? WHERE ?? = ?';
            query.values = ['stocks', 'symbol', symbol];

			await _db.query(query);
		}

		async function deleteFromQuotes(symbol) {

            let query = {};
            query.sql = 'DELETE FROM ?? WHERE ?? = ?';
            query.values = ['quotes', 'symbol', symbol];

            await _db.query(query);
		}

        await deleteFromStocks(symbol);
        await deleteFromQuotes(symbol);
	}



	async function getSymbols() {

		let sql = 'SELECT symbol FROM stocks';
        let rows = await _db.query(sql);

        var symbols = [];

        for (let row of rows) {
            if (!isString(_argv.symbol) || row.symbol.match(_argv.symbol)) {
                symbols.push(row.symbol);
            }
        }

        return symbols;
	}

	async function upsert(quotes) {
        for (let quote of quotes) {
            await _db.upsert('quotes', quote);
        };

        return quotes;
	}

	async function refresh(symbols) {


        if (!isArray(symbols))
            symbols = [symbols];

        for(let symbol of symbols) {
            let then = new Date();
            await updateStock(symbol);
            let now = new Date();
            console.log(sprintf('Statistics updated for %s in %.1f seconds.', symbol, (now - then) / 1000));	
        }

        return symbols.length;

	}


	async function download(symbols, from, to) {


        function round(value) {
            return value == null ? null : parseFloat(parseFloat(value).toFixed(4));
        }

        async function fetchFromYahoo(symbol, from, to) {

            let quotes = [];
            let items = await yahoo.historical(symbol, {period1:from, period2:to});

            for (let item of items) {
                if (isValidQuote(item)) {
                    var quote = {};

                    quote.date   = item.date;
                    quote.symbol = symbol;
                    quote.open   = round(item.open);
                    quote.high   = round(item.high);
                    quote.low    = round(item.low);
                    quote.close  = round(item.close);
                    quote.volume = item.volume;

                    quotes.push(quote);

                }
            }

            return quotes;
        }

        function isValidQuote(quote) {
            return quote && quote.open != null && quote.close != null && quote.high != null && quote.low != null;
        }



        async function fetch(symbol, from, to) {

            from = new Date(from.getFullYear(), from.getMonth(), from.getDate());
            to = new Date(to.getFullYear(), to.getMonth(), to.getDate());

            let now = new Date();
            let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (today - from <= 0) {
                console.log(sprintf('Skipping quotes for %s from %s to %s...', symbol, dateToString(from), dateToString(to)));
                return null;
            }

            return await fetchFromYahoo(symbol, from, to);
        }

        if (!isArray(symbols))
            symbols = [symbols];

        let symbolsUpdated = 0;
        let now = new Date();

        let startDates = {};

        if (to == undefined)
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (from == undefined) {
            startDates = await getStartDates();
        }

        for (let symbol of symbols) {
            
            let startDate = from;
            let endDate   = to;

            if (startDate == undefined)
                startDate = startDates[symbol];

            if (startDate == undefined) {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                startDate.setDate(startDate.getDate() - 380);
            }

            let quotes = await fetch(symbol, startDate, endDate);

            if (isArray(quotes) && quotes.length > 0) {
                symbolsUpdated++;
                console.log('Fetched %d quote(s) for symbol %s from %s to %s.', quotes.length, symbol, dateToString(from), dateToString(to));

                await upsert(quotes);
                await updateStock(symbol);
            }

        }

        return symbolsUpdated;

    
	}

	async function process() {


        let symbols = await getSymbols();

        if (symbols.length == 0) {
            throw new Error('No symbols found.');
        }

        if (_argv.refresh) {
            return await refresh(symbols);
        }

        let from = undefined;
        let to = undefined;
        let now = new Date();

        if (_argv.since) {
            from = new Date(_argv.since);
        }

        if (_argv.days) {
            from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            from.setDate(from.getDate() - _argv.days);
        }

        if (_argv.from) {
            from = new Date(_argv.from);
        }

        if (_argv.to) {
            to = new Date(_argv.to);
        }

        if (to == undefined)
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return await download(symbols, from, to);


	}




	async function work() {


        try {
            console.info('Connecting to SQL server...');

            let mysql = new MySQL();
            _db = await mysql.connect();
            let count = await process();
            console.info(`Finished downloading quotes. A total of ${count} symbol(s) downloaded and/or updated.`);
        }
        catch(error) {
            console.error(error.stack);
        }
        finally {
            if (_db != undefined)
                _db.end();            

            _db = undefined;
        }
	}


	async function schedule(cron) {

        try {
            let Schedule = require('node-schedule');
            let running  = false;

            console.info(sprintf('Scheduling to run download-quotes at cron-time "%s"...', cron));

            let job = Schedule.scheduleJob(cron, async function() {

                try {
                    if (running)
                        throw new Error('Upps! Running already!!');
    
                    try {
                        running = true;
                        await work();
                    }
                    catch(error) {
                        throw error;
                    }
                    finally {
                        running = false;
                    }
    
                }
                catch(error) {
                    console.error(error.stack);
                }
    
            });

            if (job == null) {
                throw new Error('Invalid cron time.');
            }


        }
        catch(error) {
            throw error;
        }

	}

	async function run(argv) {

		try {
			_argv = argv;

			if (isString(_argv.schedule))
				await schedule(_argv.schedule);
			else
				await work();

		}
		catch(error) {
			console.error(error.stack);
		}
	}


	module.exports.command  = ['download-quotes [options]', 'dq [options]'];
	module.exports.describe = 'Download historical data from Google Finance';
	module.exports.builder  = defineArgs;
	module.exports.handler  = run;



};
