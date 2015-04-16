/* *
 *
 * Создает простой способ доступа к JSON данным на сервере.
 * Реализует основные REST методы save, get, list, update, delete
 * В дополнение к этому есть:
 * findBy - поиск по одному из полей
 * filter - поиск по ряду полей
 *
 * */
var notRecord_stdObjectProps = {
    writable: false,
    enumerable: false
};

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

var DEFAULT_RECORD_ID_FIELD_NAME = '_id';
var DEFAULT_PAGE_NUMBER = 1;
var DEFAULT_PAGE_SIZE = 10;

var notRecord_Interface = {
    //описание методов запросов
    api: {
        //корневой урл, :modelName название модели
        url: '/api/:modelName',
        //что можно делать
        actions: {
            //добавление новой записи
            save: {
                //метод
                method: 'POST',
                // что будем передавать в массиве POST, тут механизм простой у notRecord должен быть метод с названием getFoo,
                // в данном случае getRecord, его результаты будут переданы в POST запросе,
                // все результаты возвращаемые такими функциями должны быть объектами,
                // если их несколько, то они будут объединены в один объект
                data: ['record']
            },
            //получать по номеру записи
            get: {
                method: 'GET',
                //то что будет, прибавленно к URL
                postFix: '/:record['+DEFAULT_RECORD_ID_FIELD_NAME+']'
                //:record[название поля из объекта], варианты /:record[_id]/:record[name] или /:record[date]
                //поле должно существовать
            },
            //получить массив
            list: {
                method: 'GET',
                //применяются данные для постраницной выдачи
                data: ['pager'],
                isArray: true
            },
            //поиск по паре [название поля],[значение поля]
            findBy: {
                method: 'POST',
                postFix: '/findBy',
                data: ['filter']
            },
            //более комплексный вариант, пар может быть много
            filter: {
                method: 'POST',
                postFix: '/filter',
                data: ['pager', 'filter'],
                isArray: true
            },
            //сохранение изменений
            update: {
                method: 'PUT',
                postFix: '/:record['+DEFAULT_RECORD_ID_FIELD_NAME+']'
            },
            //удаление записи с сервера
            delete: {
                method: 'DELETE',
                postFix: '/:record['+DEFAULT_RECORD_ID_FIELD_NAME+']'
            }
        }
    },

    extendObject: function (obj1, obj2) {
        for (var attrname in obj2) {
            obj1[attrname] = obj2[attrname];
        }
        return obj1;
    },

    parseLine: function (line, record) {
        var i = 0;
        var recordRE = /:record\[([\dA-z_-]+)\]/gi;
        var recordFields = line.match(recordRE);
        if (recordFields.length > 1) {
            for (i = 1; i < recordFields.length; i++) {
                line = line.replace(':record[' + recordFields[i] + ']', record[recordFields[i]]);
            }
        }
        line = line.replace(':modelName', record.modelName);
        return line;
    },

    getURL: function (record, actionData) {
        var line = this.parseLine(this.api.url, record) + this.parseLine(actionData.postFix, record);
        return line;
    },

    collectRequestData: function(record, actionData){
        var requestData = {}, i = 0;
        if (('data' in actionData) && typeof(actionData.data)!=='undefined' && actionData.data!==null){
            for (i=0;i<actionData.data.length;i++){
                var dataProviderName = 'get'+capitalizeFirstLetter(actionData.data[i]);
                if (dataProviderName in record){
                    requestData = this.extendObject(requestData, record[dataProviderName]());
                }
            }
        }
        return requestData;
    },

    request: function(record, action, callback){
        var actionData = this.api.actions[action];
        $.ajax(this.getURL(record, actionData), {
            method: actionData.method,
            dataType: 'json',
            data: this.collectRequestData(record, actionData),
            success: function (data) {
                var result = [];
                if (('isArray' in actionData)  && actionData.isArray){
                    $.each(data, function (index, item) {
                        result.push(new notRecord(record.modelName, item));
                    });
                }else{
                    result = new notRecord(record.modelName, data);
                }
                callback(result);
            }
        });
    }
};

/*
 *
 */

//создаем объект с заданой моделью, если есть данные, то добавляем в него его
var notRecord = function (modelName, item) {
    this._notOptions = {
        modelName: modelName,
        filter: {},
        pageNumber: DEFAULT_PAGE_NUMBER,
        pageSize: DEFAULT_PAGE_SIZE,
        fields: []
    };
    if (typeof item !== 'undefined' && item !== null) {
        this = notRecord_Interface.extendObject(this, item);
        this._notOptions.fields = Object.keys(item);
    }
    return this;
};

Object.defineProperties(notRecord.prototype, {
    '_notOptions': {
        enumerable: false
    },
    'save': notRecord_stdObjectProps,
    'get': notRecord_stdObjectProps,
    'list': notRecord_stdObjectProps,
    'findBy': notRecord_stdObjectProps,
    'filter': notRecord_stdObjectProps,
    'setFilter': notRecord_stdObjectProps,
    'setFindBy': notRecord_stdObjectProps,
    'setPager': notRecord_stdObjectProps,
    'setPageNumber': notRecord_stdObjectProps,
    'setPageSize': notRecord_stdObjectProps,
    //'getFilter': notRecord_stdObjectProps,
    //'getPager': notRecord_stdObjectProps,
    'update': notRecord_stdObjectProps,
    'delete': notRecord_stdObjectProps,
    'modelName': {
        get: function () {
            return this._notOptions.modelName;
        }
    }
});


notRecord.prototype.setFilter = function (filterData) {
    this._notOptions.filter = filterData;
    return this;
};

notRecord.prototype.getFilter = function () {
    return this._notOptions.filter;
};

notRecord.prototype.setPageNumber = function (pageNumber) {
    this._notOptions.pageNumber = pageNumber;
    return this;
};

notRecord.prototype.setPageSize = function (pageSize) {
    this._notOptions.pageSize = pageSize;
    return this;
};

notRecord.prototype.setPager = function (pageSize, pageNumber) {
    this._notOptions.pageSize = pageSize;
    this._notOptions.pageNumber = pageNumber;
    return this;
};

notRecord.prototype.getPager = function () {
    return {
        pageSize: this._notOptions.pageSize,
        pageNumber: this._notOptions.pageNumber
    };
};

notRecord.prototype.getRecord = function () {
    var result = {};
    for (fieldName in this._notOptions.fields){
        if (fieldName in this) obj[fieldName] = this[fieldName];
    }
    return result;
};

notRecord.prototype.setFindBy = function (key, value) {
    return this.setFilter({[key]: value});
};



notRecord.prototype.save = function (callback) {
    notRecord_Interface.request(this, 'save' ,callback);
};

notRecord.prototype.get = function (recordId, callback) {
    this[DEFAULT_RECORD_ID_FIELD_NAME] = recordId;
    notRecord_Interface.request(this, 'get', callback);
};

notRecord.prototype.list = function (callback) {
    notRecord_Interface.request(this, 'list',callback);
};

notRecord.prototype.findBy = function (key, value, callback) {
    this.setFindBy(key, value);
    notRecord_Interface.request(this, 'filter', callback);
};

notRecord.prototype.filter = function (callback) {
    notRecord_Interface.request(this, 'filter', callback);
};

notRecord.prototype.update = function (callback) {
    notRecord_Interface.request(this, 'update', callback);
};

notRecord.prototype.delete = function (callback) {
    notRecord_Interface.request(this, 'delete', callback);
};
