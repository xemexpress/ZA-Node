var mongoose = require('mongoose'),
    router = require('express').Router()
var auth = require('../auth')
var User = mongoose.model('User'),
    Company = mongoose.model('Company'),
    Record = mongoose.model('Record')

// Preload Company's symbol
router.param('symbol', (req, res, next, symbol) => {
  req.symbol = symbol

  next()
})

// Preload Record's year
router.param('year', (req, res, next, year) => {
  req.year = year

  next()
})

// Preload Segment's index
router.param('index', (req, res, next, index) => {
  req.index = index

  next()
})

function zaCompanyByAuthorSymbol(userId, companySymbol){
  return Company.findOne({ author: userId, symbol: companySymbol })
                .populate('records', 'year')
}

function zaRecordFromCompanyByYear(company, year){
  let recordId = company.records.find((record) => record.year === year)._id

  return Record.findById(recordId)
}

// List Companies
router.get('/', auth.required, (req, res, next) => {
  let query = { author: req.payload.id }
  let limit = 24
  let offset = 0

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset
  }

  if(typeof req.query.tag !== 'undefined'){
    query.tagList = { $in: [req.query.tag]}
  }

  Company.find(query)
    .skip(Number(offset))
    .limit(Number(limit))
    .sort({ createdAt: -1 })
    .then((companies) => {
      return res.json({
        companies: companies.map((company) => {
          return company.toJSONFor()
        }),
        companiesCount: companies.length
      })
    }).catch(next)
})

// Create Company
router.post('/', auth.required, (req, res, next) => {
  User.findById(req.payload.id).then((user) => {
    if(!user){ return res.sendStatus(401) }

    // Should check if user already has the symbol.
    Company.findOne({ author: req.payload.id, symbol: req.body.company.symbol }).then((company) => {
      if(!company){
        var company = new Company(req.body.company)
        
        company.author = user

        return company.save().then(() => {
          return res.json({ company: company.toJSONFor() })
        })
      }
      else{
        return res.status(422).json({ errors: { 'company with the same symbol': 'already exists' } })
      }
    }).catch(next)
  }).catch(next)
})

// Update Company
router.put('/:symbol', auth.required, (req, res, next) => {
  Company.findOne({ author: req.payload.id, symbol: req.symbol }).then((company) => {
    if(!company){ return res.sendStatus(401) }

    if(typeof req.body.company.symbol !== 'undefined'){
      company.symbol = req.body.company.symbol
    }

    if(typeof req.body.company.name !== 'undefined'){
      company.name = req.body.company.name
    }

    if(typeof req.body.company.abbr !== 'undefined'){
      company.abbr = req.body.company.abbr
    }

    if(typeof req.body.company.logo !== 'undefined'){
      company.logo = req.body.company.logo
    }

    if(typeof req.body.company.tagList !== 'undefined'){
      company.tagList = req.body.company.tagList
    }

    return company.save().then(() => {
      return res.json({ company: company.toJSONFor() })
    })
  }).catch(next)
})

// Delete Company
router.delete('/:symbol', auth.required, (req, res, next) => {
  Company.findOneAndRemove({ author: req.payload.id, symbol: req.symbol }).then((company) => {
    if(!company){ return res.sendStatus(401) }
    
    return Record.remove({ company: company._id }).then(() => {
      return res.sendStatus(204)
    })
  })
})

// Get Records from a Company
router.get('/:symbol/records', auth.required, (req, res, next) => {
  Company.findOne({ author: req.payload.id, symbol: req.symbol })
    .populate({
      path: 'records',
      options: {
        sort: { year: 1 }
      }
    })
    .then((company) => {
      if(!company){ return res.sendStatus(401) }
      
      return res.json({
        records: company.records.map((record) => {
          return record.toJSONFor()
        }),
        recordsCount: company.records.length
      })
    }).catch(next)
})

// Add Record to a Company
router.post('/:symbol/records', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }
    console.log('records:',company.records)
    if(company.records.every((record) => record.year !== req.body.record.year)){
      var record = new Record(req.body.record)
      record.forCompany = company

      return record.save().then(() => {
        company.records.push(record)

        return company.save().then(() => {
          return res.json({ record: record.toJSONFor() })
        })
      })
    }else{
      return res.status(422).json({ errors: { 'year': "can't be repeated" } })
    }
  }).catch(next)
})

// Update Record
router.put('/:symbol/records/:year', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }
      
      if(typeof req.body.record.key !== 'undefined'){
        record.key = req.body.record.key
      }

      if(typeof req.body.record.businessSegments !== 'undefined'){
        record.businessSegments = req.body.record.businessSegments
      }

      if(typeof req.body.record.grossProfitMargin !== 'undefined'){
        record.grossProfitMargin = req.body.record.grossProfitMargin
      }

      if(typeof req.body.record.plans !== 'undefined'){
        record.plans = req.body.record.plans
      }

      if(typeof req.body.record.actionsDone !== 'undefined'){
        record.actionsDone = req.body.record.actionsDone
      }

      return record.save().then(() => {
        return res.json({ record: record.toJSONFor() })
      })
    }).catch(next)
  }).catch(next)
})

// Update Record.BusinessSegments

// Add Bussiness
router.post('/:symbol/records/:year/segments', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      if(req.body.newBusiness._id){ delete req.body.newBusiness._id }
      record.businessSegments.push(req.body.newBusiness)

      return record.save().then(() => {
        return res.json({ record: record.toJSONFor() })
      })
    }).catch(next)
  }).catch(next)
})

// Update Business
router.put('/:symbol/records/:year/segments/:index', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      if(typeof req.body.segment.business !== 'undefined'){
        record.businessSegments[req.index].business = req.body.segment.business
      }

      if(typeof req.body.segment.grossProfitMargin !== 'undefined'){
        record.businessSegments[req.index].grossProfitMargin = req.body.segment.grossProfitMargin
      }

      if(typeof req.body.segment.share !== 'undefined'){
        record.businessSegments[req.index].share = req.body.segment.share
      }

      return record.save().then(() => {
        return res.json({ record: record.toJSONFor() })
      })
    }).catch(next)
  }).catch(next)
})

// Remove Business
router.delete('/:symbol/records/:year/segments/:index', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      record.businessSegments.splice(req.index, 1)

      return record.save().then(() => {
        return res.sendStatus(204)
      })
    }).catch(next)
  }).catch(next)
})

// Update Record.Plans

// Add Plan
router.post('/:symbol/records/:year/plans', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      if(req.body.newPlan._id){ delete req.body.newPlan._id }
      record.plans.push(req.body.newPlan)
      
      return record.save().then(() => {
        return res.json({ record: record.toJSONFor() })
      })
    }).catch(next)
  }).catch(next)
})

// Update Plan
router.put('/:symbol/records/:year/plans/:index', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      if(typeof req.body.plan.action !== 'undefined'){
        record.plans[req.index].plan = req.body.plan.action
      }

      if(typeof req.body.plan.executed != 'undefined'){
        record.plans[req.index].executed = req.body.plan.executed
      }

      return record.save().then(() => {
        return res.json({ record: record.toJSONFor() })
      })
    }).catch(next)
  }).catch(next)
})

// Delete Plan
router.delete('/:symbol/records/:year/plans/:index', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      record.plans.splice(req.index, 1)

      return record.save().then(() => {
        return res.sendStatus(204)
      })
    }).catch(next)
  }).catch(next)
})

// Update Record.ActionsDone

// Add ActionDone
router.post('/:symbol/records/:year/actions', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      record.actionsDone.push(req.body.action.done)
        
      return record.save().then(() => {
        return res.json({ record: record.toJSONFor() })
      })
    }).catch(next)
  }).catch(next)
})

// Update ActionDone
router.put('/:symbol/records/:year/actions/:index', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      record.actionsDone.splice(req.index, 1, req.body.action.done)

      return record.save().then(() => {
        return res.json({ record: record.toJSONFor() })
      })
    }).catch(next)
  }).catch(next)
})

// Remove ActionDone
router.delete('/:symbol/records/:year/actions/:index', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }

    zaRecordFromCompanyByYear(company, req.year).then((record) => {
      if(!record){ return res.sendStatus(401) }

      record.actionsDone.splice(req.index, 1)

      return record.save().then(() => {
        return res.sendStatus(204)
      })
    }).catch(next)
  }).catch(next)
})

// Delete Record
router.delete('/:symbol/records/:year', auth.required, (req, res, next) => {
  zaCompanyByAuthorSymbol(req.payload.id, req.symbol).then((company) => {
    if(!company){ return res.sendStatus(401) }
    
    let recordId = company.records.find((record) => record.year === req.year)._id
    company.records.remove(recordId)
    company.save().then(() => {
      Record.remove({ _id: recordId }).then(() => {
        return res.sendStatus(204)
      })
    })
  }).catch(next)
})

module.exports = router