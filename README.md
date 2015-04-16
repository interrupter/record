# record
Simple ORM for JS front-end

#how to use

//create new with model 'car', set name, save
var car = new notRecord('car');
car.name = 'Delorean';
car.save(callback);
//
car.get(1, callback);
car.setPageNumber(page).setPageSize(recsOnPage).list(callback);
car.setFilter(filter).setPager(page, recsOnPage).filter(callback);
car.findBy(key, value, callback);
car.update(callback);
car.delete(callback);
