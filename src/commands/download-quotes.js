var sprintf = require("yow/sprintf");
var isArray = require("yow/isArray");
var isString = require("yow/isString");
var isDate = require("yow/isDate");
var isInteger = require("yow/isInteger");
var yahoo = require("yahoo-finance2").default;
var MySQL = require("../scripts/mysql.js");

class Probe {
    constructor() {
        this.startTime = null;
        this.stopTime = null;

        this.start();
    }

    start() {
        this.startTime = new Date();
    }

    stop() {
        this.stopTime = new Date();
    }

    toString() {
        if (this.startTime == null) this.start();

        if (this.stopTime == null) this.stop();

        let then = this.startTime;
        let now = this.stopTime;
        let seconds = Math.round(((now - then) / 1000) * 10) / 10;
        let text = `${seconds} seconds`;

        if (seconds > 60) {
            text = `${Math.round(seconds / 60)} minute(s)`;
        }

        return text;
    }
}

var Module = new (function () {
    var _db = new MySQL();
    var _argv = undefined;

    function debug() {
        console.log.apply(this, arguments);
    }

    function defineArgs(args) {
        args.option("symbol", { alias: "s", describe: "Download specified symbol only" });
        args.option("days", { alias: "d", describe: "Specifies number of days back in time to fetch" });
        args.option("since", { alias: "c", describe: "Fetch quotes since the specified date" });
        args.option("from", { alias: "f", describe: "Fetch quotes from the specified date" });
        args.option("to", { alias: "t", describe: "Fetch quotes to the specified date" });
        args.option("loop", { alias: "o", describe: "Run again after specified number of minutes", default: 180 });
        args.option("pause", { alias: "p", describe: "Pause for number of seconds between batches", default: 0 });
        args.option("refresh", { alias: "r", describe: "Refresh statistics", default: false });
        args.option("clean", { alias: "l", describe: "Clean out", default: false });
        args.help();

        args.wrap(null);
        args.wrap(null);

        args.check(function (argv) {
            if ((argv.from && !argv.to) || (!argv.from && argv.to)) throw new Error("Must specify both --from and --to.");

            if (argv.days && argv.since) throw new Error("Cannot specify both --since and --days.");

            if (argv.days && !isInteger(argv.days)) {
                throw new Error(sprintf('Invalid number of days "%s".', argv.days));
            }

            if (argv.from) {
                if (!isDate(new Date(argv.from))) throw new Error(sprintf('Invalid date "%s".', argv.from));
            }

            if (argv.to) {
                if (!isDate(new Date(argv.to))) throw new Error(sprintf('Invalid date "%s".', argv.to));
            }

            if (argv.since) {
                if (!isDate(new Date(argv.since))) throw new Error(sprintf('Invalid date "%s".', argv.since));
            }

            return true;
        });
    }

    async function query(sql) {
        return await _db.query(sql);
    }

    async function upsert(table, rows) {
        if (!isArray(rows)) rows = [rows];

        for (let row of rows) {
            await _db.upsert(table, row);
        }

        return rows;
    }



    async function updateStock(symbol) {
        function computeSMA(quotes, days) {
            if (quotes.length < days) return null;

            var sum = 0;

            for (var index = 0; index < days; index++) {
                sum += quotes[index].close;
            }

            return parseFloat((sum / days).toFixed(2));
        }

        function computeDOG(quotes, SMA, DOG) {
            let now = new Date();
            let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            let quote = quotes[0];

            if (quote.close < SMA && DOG == null) return today;
            else if (quote.close >= SMA) return null;
            else return DOG;
        }

        function computeAV(quotes, days) {
            if (quotes.length < days) return null;

            var sum = 0;

            for (var index = 0; index < days; index++) sum += quotes[index].volume;

            return parseInt((sum / days).toFixed(0));
        }

        function computeWL(quotes, weeks) {
            var days = weeks * 5;

            if (quotes.length < days) return null;

            var min = undefined;

            for (var index = 0; index < days; index++) min = min == undefined ? quotes[index].close : Math.min(min, quotes[index].close);

            return min;
        }

        function computeWH(quotes, weeks) {
            var days = weeks * 5;

            if (quotes.length < days) return null;

            var max = undefined;

            for (var index = 0; index < days; index++) max = max == undefined ? quotes[index].close : Math.max(max, quotes[index].close);

            return max;
        }

        function computeATR(quotes, days) {
            if (quotes.length < days + 1) return null;

            var sum = 0;

            for (var index = 0; index < days; index++) {
                var A = quotes[index].high - quotes[index].low;
                var B = Math.abs(quotes[index].low - quotes[index + 1].close);
                var C = Math.abs(quotes[index].high - quotes[index + 1].close);

                sum += Math.max(Math.max(A, B), C);
            }

            return parseFloat((sum / days).toFixed(2));
        }

        async function getStock(symbol) {
            function isValidName(name) {
                return typeof name == "string" && name != "n/a";
            }

            let sql = {};
            sql.sql = "SELECT * FROM stocks WHERE ?? = ?";
            sql.values = ["symbol", symbol];

            let stocks = await query(sql);
            let stock = stocks.length == 1 ? stocks[0] : {};

            if (stocks.length == 0) {
                throw new Error(`Symbol not ${symbol} not found.`);
            }

            let modules = ["price", "summaryProfile", "quoteType", "assetProfile"];
            let summary = await yahoo.quoteSummary(symbol, { modules: modules });

            stock.name = summary.price.longName ? summary.price.longName : summary.price.shortName;

            stock.sector = summary.assetProfile && isValidName(summary.assetProfile.sector) ? summary.assetProfile.sector : "";
            stock.industry = summary.assetProfile && isValidName(summary.assetProfile.industry) ? summary.assetProfile.industry : "";
            stock.country = summary.assetProfile && isValidName(summary.assetProfile.country) ? summary.assetProfile.country : "";
            stock.exchange = isValidName(summary.price.exchangeName) ? summary.price.exchangeName : "";
            stock.type = isValidName(summary.price.quoteType) ? summary.price.quoteType : "";

            return stock;
        }

        async function getQuotes(symbol) {
            let sql = {};
            sql.sql = "SELECT * FROM quotes WHERE symbol = ? ORDER BY date DESC LIMIT ?";
            sql.values = [symbol, 51 * 5];

            return await query(sql);
        }

        let stock = await getStock(symbol);
        let quotes = await getQuotes(symbol);

        if (quotes.length > 0) {
            stock = { ...stock, ...quotes[0] };

            stock.SMA200 = computeSMA(quotes, 200);
            stock.SMA50 = computeSMA(quotes, 50);
            stock.SMA20 = computeSMA(quotes, 20);
            stock.SMA10 = computeSMA(quotes, 10);
            stock.AV14 = computeAV(quotes, 14);
            stock.WL51 = computeWL(quotes, 51);
            stock.WH51 = computeWH(quotes, 51);
            stock.ATR14 = computeATR(quotes, 14);
            stock.DOG200 = computeDOG(quotes, stock.SMA200, stock.DOG200);
            stock.timestamp = new Date();

            await upsert("stocks", stock);
        }
    }

    async function getStartDates() {
        console.log("Fetching last quote dates...");

        let sql = "SELECT symbol, MAX(date) as date FROM quotes GROUP BY symbol";
        let rows = await query(sql);
        let dates = {};

        rows.forEach(function (row) {
            var date = new Date(row.date);
            date.setDate(date.getDate() + 1);

            dates[row.symbol] = date;
        });

        return dates;
    }


    async function getSymbols() {
        let sql = "SELECT symbol FROM stocks ORDER by symbol ASC";
        let rows = await query(sql);
        let symbols = [];

        for (let row of rows) {
            if (_argv.symbol) {
                let filters = isArray(_argv.symbol) ? _argv.symbol : [_argv.symbol];

                for (let filter of filters) {
                    if (row.symbol.match(`^${filter}$`) != null) {
                        symbols.push(row.symbol);
                        break;
                    }
                }
            } else symbols.push(row.symbol);
        }

        return symbols;
    }

    async function refresh(symbols) {
        if (!isArray(symbols)) symbols = [symbols];

        for (let symbol of symbols) {
            await updateStock(symbol);
        }

        return symbols.length;
    }

    async function cleanUp() {
        console.log("Cleaning up...");
        await query("DELETE FROM stocks WHERE name IS NULL");
        await query("DELETE FROM quotes WHERE quotes.symbol NOT IN (SELECT symbol FROM stocks)");
    }

    function log(message) {
        _db.upsert("log", { message: message });
        console.log(message);
    }

    async function download(symbols, from, to) {
        function round(value) {
            return value == null ? null : parseFloat(parseFloat(value).toFixed(4));
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
                return null;
            }

            let quotes = [];
            let items = await yahoo.historical(symbol, { period1: from, period2: to });

            for (let item of items) {
                if (isValidQuote(item)) {
                    var quote = {};

                    quote.date = item.date;
                    quote.symbol = symbol;
                    quote.open = round(item.open);
                    quote.high = round(item.high);
                    quote.low = round(item.low);
                    quote.close = round(item.close);
                    quote.volume = item.volume;

                    quotes.push(quote);
                }
            }

            return quotes;
        }

        if (!isArray(symbols)) symbols = [symbols];

        let startDates = {};
        let symbolsUpdated = 0;
        let quotesUpdated = 0;
        let now = new Date();
        let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (to == undefined) to = today;

        if (from == undefined) startDates = await getStartDates();

        for (let symbol of symbols) {
            let startDate = from;
            let endDate = to;

            if (startDate == undefined) startDate = startDates[symbol];

            if (startDate == undefined) {
                startDate = new Date();
                startDate.setDate(today.getDate() - 380);
            }

            try {
                let probe = new Probe();
                let quotes = await fetch(symbol, startDate, endDate);

                if (isArray(quotes) && quotes.length > 0) {
                    symbolsUpdated++;
                    quotesUpdated += quotes.length;

                    await upsert("quotes", quotes);
                    await refresh(symbol);

                }
            } catch (error) {
                let message = `Failed to download symbol ${symbol}. ${error.message}.`;
                log(message);
            }
        }

        return { quotes: quotesUpdated, symbols: symbolsUpdated };
    }

    async function process() {
        let symbols = await getSymbols();

        if (symbols.length == 0) {
            throw new Error("No symbols found.");
        }

        if (_argv.clean) {
            return await cleanUp();
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

        if (to == undefined) to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let result = await download(symbols, from, to);

        await cleanUp();

        return result;
    }

    function connect() {
        _db.connect();
    }

    function disconnect() {
        _db.disconnect();
    }

    async function work() {
        try {
            let probe = new Probe();

            connect();
            
            log(`Starting download.`);            
            let { symbols, quotes } = await process();
            log(`Finished downloading. A total of ${symbols} symbol(s) and ${quotes} quote(s) downloaded and updated in ${probe.toString()}.`);
        } catch (error) {
            console.error(error.stack);
        } finally {
            disconnect();
        }

        if (_argv.loop) {
            let loop = _argv.loop;
            console.log(`Waiting for next loop (${loop} minutes)...`);

            setTimeout(() => {
                work();
            }, loop * 1000 * 60);
        }
    }

    async function wait(ms) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }

    async function run(argv) {
        try {
            _argv = argv;

            await work();
        } catch (error) {
            console.error(error.stack);
        }
    }

    module.exports.command = ["download-quotes [options]", "dq [options]"];
    module.exports.describe = "Download historical data from Google Finance";
    module.exports.builder = defineArgs;
    module.exports.handler = run;
})();
