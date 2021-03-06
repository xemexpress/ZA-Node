var mongoose = require('mongoose'),
    router = require('express').Router()
var auth = require('../auth')
var Article = mongoose.model('Article')

// Preload Article
router.param('article', (req, res, next, id) => {
  Article.findById(id).then(article => {
    if(!article){ return res.sendStatus(404) }

    req.article = article

    return next()
  }).catch(next)
})

// List Articles
router.get('/', auth.optional, (req, res, next) => {
  var limit = 10
  var offset = 0

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset
  }

  Article.find()
    .skip(Number(offset))
    .limit(Number(limit))
    .sort({ createdAt: -1 })
    .then(articles => {
      return res.json({
        articles: articles.map(article => {
          return article.toJSONFor()
        }),
        articlesCount: articles.length
      })
    }).catch(next)
})

// Create Article (Admin pass required)
router.post('/', auth.required, (req, res, next) => {
  if(req.payload.username === auth.admin){
    var article = new Article(req.body.article)

    article.save().then(() => {
      return res.json({ article: article.toJSONFor() })
    }).catch(next)
  }else{
    return res.sendStatus(403)
  }
})

// Update Article (Admin pass required)
router.put('/:article', auth.required, (req, res, next) => {
  if(req.payload.username === auth.admin){
    if(typeof req.body.article.title !== 'undefined'){
      req.article.title = req.body.article.title
    }

    if(typeof req.body.article.body !== 'undefined'){
      req.article.body = req.body.article.body
    }
    
    if(typeof req.body.article.image !== 'undefined'){
      req.article.image = req.body.article.image
    }

    req.article.save().then(() => {
      return res.json({ article: req.article.toJSONFor() })
    }).catch(next)
  }else{
    return res.sendStatus(403)
  }
})

// Delete Article (Admin pass required)
router.delete('/:article', auth.required, (req, res, next) => {
  if(req.payload.username === auth.admin){
    req.article.deleteMany().then(() => {
      return res.sendStatus(204)
    }).catch(next)
  }else{
    return res.sendStatus(403)
  }
})

module.exports = router
