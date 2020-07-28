import { __spreadArrays } from "tslib";
import utils from './modules/utils';
import { FPInputError, FunctionalError } from './modules/errors';
var isEnumerable = utils.isEnumerable;
export default function (FP) {
    return { map: map, find: find, findIndex: findIndex, filter: filter, flatMap: flatMap, reduce: reduce };
    function find(callback) { return _find.call(this, callback).then(function (_a) {
        var item = _a.item;
        return item;
    }); }
    function findIndex(callback) { return _find.call(this, callback).then(function (_a) {
        var index = _a.index;
        return index;
    }); }
    function _find(iterable, callback) {
        if (this.steps)
            return this.addStep('_find', __spreadArrays(arguments));
        if (typeof iterable === 'function') {
            callback = iterable;
            iterable = this._FP.promise;
        }
        return FP.resolve(iterable)
            .filter(callback)
            .then(function (results) { return results[0] != undefined ? { item: results[0], index: results.indexOf(results[0]) } : { item: undefined, index: -1 }; });
    }
    function flatMap(iterable, callback) {
        if (this.steps)
            return this.addStep('flatMap', __spreadArrays(arguments));
        if (typeof iterable === 'function') {
            callback = iterable;
            iterable = this._FP.promise;
        }
        return FP.resolve(iterable)
            .map(callback)
            .reduce(function (acc, arr) { return acc.concat.apply(acc, arr); }, []);
    }
    function filter(iterable, callback) {
        if (this.steps)
            return this.addStep('filter', __spreadArrays(arguments));
        if (typeof iterable === 'function') {
            callback = iterable;
            iterable = this._FP.promise;
        }
        return reduce.call(this, iterable, function (acc, item) { return Promise.resolve(callback(item)).then(function (x) { return (x ? acc.concat([item]) : acc); }); }, []);
    }
    function reduce(iterable, reducer, initVal) {
        if (this.steps)
            return this.addStep('reduce', __spreadArrays(arguments));
        if (typeof iterable === 'function') {
            initVal = reducer;
            reducer = iterable;
            iterable = this._FP ? this._FP.promise : this;
        }
        else
            iterable = FP.resolve(iterable, this);
        return new FP(function (resolve, reject) {
            return iterable.then(function (iterable) {
                var iterator = iterable[Symbol.iterator]();
                var i = 0;
                var next = function (total) {
                    var current = iterator.next();
                    if (current.done)
                        return resolve(total);
                    Promise.all([total, current.value])
                        .then(function (_a) {
                        var total = _a[0], item = _a[1];
                        return next(reducer(total, item, i++));
                    })["catch"](reject);
                };
                next(initVal);
            });
        });
    }
    /*eslint max-statements: ["error", 60]*/
    function map(args, fn, options) {
        var _this = this;
        if (this.steps)
            return this.addStep('map', __spreadArrays(arguments));
        if (arguments.length === 1 && this && this._FP) {
            fn = args;
            args = this && this._FP && this._FP.promise;
        }
        var resolvedOrRejected = false;
        var threadLimit = Math.max(1, (this && this._FP && this._FP.concurrencyLimit || 1));
        var innerValues = this && this._FP && this._FP.promise ? this._FP.promise : Promise.resolve(args);
        var initialThread = 0;
        var errors = [];
        var count = 0;
        var results = [];
        var threadPool = new Set();
        var threadPoolFull = function () { return threadPool.size >= threadLimit; };
        var isDone = function () { return errors.length > _this._FP.errors.limit || count >= args.length || resolvedOrRejected; };
        var setResult = function (index) { return function (value) {
            threadPool["delete"](index);
            results[index] = value;
            return value;
        }; };
        return FP.resolve(new Promise(function (resolve, reject) {
            var resolveIt = function (x) {
                // console.log('Action.resolve:', resolvedOrRejected, x)
                if (resolvedOrRejected) {
                    return null;
                }
                else {
                    resolvedOrRejected = true;
                }
                resolve(x);
            };
            var rejectIt = function (x) {
                if (resolvedOrRejected) {
                    return null;
                }
                else {
                    resolvedOrRejected = true;
                }
                // console.log('Action.reject:', resolvedOrRejected, x)
                reject(x);
            };
            innerValues.then(function (items) {
                args = __spreadArrays(items);
                if (!isEnumerable(items))
                    return reject(new FPInputError('Invalid input data passed into FP.map()'));
                var complete = function () {
                    var action = null;
                    if (errors.length > _this._FP.errors.limit)
                        action = rejectIt;
                    if (isDone())
                        action = resolveIt;
                    if (action)
                        return Promise.all(results).then(function (data) { return action(results); }) ? true : true;
                    return false;
                };
                var checkAndRun = function (val) {
                    // console.log('checkAndRun', count, resolvedOrRejected, val)
                    if (resolvedOrRejected)
                        return;
                    if (!complete() && !results[count])
                        runItem(count);
                    return val;
                };
                var runItem = function (c) {
                    if (resolvedOrRejected) {
                        return null;
                    }
                    else {
                        count++;
                    }
                    if (threadPoolFull())
                        return setTimeout(function () { return runItem(c); }, 0);
                    if (results[c])
                        return results[c];
                    threadPool.add(c);
                    // either get value with `fn(item)` or `item.then(fn)`
                    results[c] = Promise.resolve(args[c])
                        .then(function (val) { return fn(val, c, args); })
                        .then(function (val) { return setResult(c)(val); })
                        .then(checkAndRun)["catch"](function (err) {
                        _this._FP.errors.count++;
                        errors.push(err);
                        // console.log('ERR HANDLER!', errors.length, this._FP.errors.limit)
                        if (errors.length > _this._FP.errors.limit) {
                            var fpErr_1 = errors.length === 1 ? err : new FunctionalError("Error Limit " + _this._FP.errors.limit + " Exceeded.\n                idx=" + c + " errCnt=" + _this._FP.errors.count, { errors: errors, results: results, ctx: _this });
                            Promise.resolve(setResult(c)(err)).then(function () { return rejectIt(fpErr_1); });
                        }
                        else { // console.warn('Error OK:', JSON.stringify(this._FP.errors))
                            return Promise.resolve().then(function () { return setResult(c)(err); }).then(checkAndRun);
                        }
                    });
                    return results[c];
                };
                // Kick off x number of initial threads
                while (initialThread < threadLimit && initialThread < args.length)
                    runItem(initialThread++);
            });
        }));
    }
}
//# sourceMappingURL=arrays.js.map