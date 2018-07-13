import Metadata from '../models/metadata.model'
import Marker from '../models/marker.model'
import { APICustomResponse, APIError } from '../../server/helpers/APIError'
import logger from '../../config/winston'
import userCtrl from './user.controller'
import revisionCtrl from './revision.controller'

const linkedTypeAccessor = {
  "m": 0,
  "markers": 0,
  "me": 1,
  "metadata": 1
}

/**
 * Load metadata and append to req.
 */
function load(req, res, next, id) {
  Metadata.get(id, req.method)
    .then((metadata) => {
      req.entity = metadata // eslint-disable-line no-param-reassign
      return next()
    })
    .catch(e => next(e))
}

/**
 * Get metadata
 * @returns {Metadata}
 */
function get(req, res) {
  return res.json(req.entity)
}

/**
 * Create new metadata
 * @property {string} req.body.key - The key of metadata.
 * @property {string} req.body.data - The data of metadata.
 * @returns {Metadata}
 */
function create(req, res, next) {
  Metadata.findById(req.body._id)
    .exec()
    .then((foundMetadata) => {
      if (foundMetadata && !req.body.parentId) {
        const err = new APIError('This id already exists!', 400)
        next(err)
      } else if (foundMetadata && req.body.parentId) {
        createNodeOne(foundMetadata, req, res, next)
      } else {
        const metadata = new Metadata({
          _id: req.body._id,
          coo: req.body.coo,
          data: req.body.data,
          wiki: req.body.wiki,
          type: req.body.type,
          subtype: req.body.subtype,
          year: req.body.year,
        })

        metadata.save({ checkKeys: false })
          .then(savedMetadata => res.json(savedMetadata))
          .catch(e => next(e))
      }
    })
    .catch(e => next(e))
}

function addConnection(req, res, next) {

}

function removeConnection(req, res, next) {

}

function createNodeOne(metadata, req, res, next) {
  const parentId = req.body.parentId
  const childId = req.body.childId
  const childValue = req.body.childValue

  if (typeof metadata.data[parentId] !== 'undefined' &&
    typeof metadata.data[parentId][childId] !== 'undefined') {
    res.status(400).send('This entity already exists.')
  }

  if (typeof parentId !== 'undefined' &&
    typeof childId !== 'undefined' &&
    typeof metadata.data[parentId] !== 'undefined' &&
    typeof metadata.data[parentId][childId] === 'undefined' &&
    typeof childValue !== 'undefined') {
    metadata.data[parentId][childId] = childValue
    metadata.markModified('data')
  }

  metadata.save()
    .then(savedMetadata => res.json({}))
    .catch(e => next(e))
}

/**
 * Update existing metadata
 * @property {string} req.body.key - The key of metadata.
 * @property {string} req.body.data - The data of metadata.
 * @returns {Metadata}
 */
function update(req, res, next, fromRevision = false) {
  const metadata = req.entity
  if (typeof req.body._id !== 'undefined') metadata._id = req.body._id
  if (typeof req.body.coo !== 'undefined') metadata.coo = req.body.coo
  if (typeof req.body.data !== 'undefined') metadata.data = req.body.data
  if (typeof req.body.type !== 'undefined') metadata.type = req.body.type
  if (typeof req.body.subtype !== 'undefined') metadata.subtype = req.body.subtype
  if (typeof req.body.year !== 'undefined') metadata.year = req.body.year
  if (typeof req.body.wiki !== 'undefined') metadata.wiki = req.body.wiki
  if (typeof req.body.year !== 'undefined') metadata.year = req.body.year
  if (typeof req.body.score !== 'undefined') metadata.score = req.body.score

  metadata.save()
    .then((savedMetadata) => { if (!fromRevision) res.json(savedMetadata) })
    .catch((e) => { if (!fromRevision) next(e) })
}

function vote(delta) {
  return (req, res, next) => {
    const username = (req.auth || {}).username
    const metadata = req.entity
    metadata.score += delta

    metadata.save()
      .then((savedMetadata) => {
        if (username) userCtrl.changePoints(username, 'voted', 1)
        res.json(savedMetadata)
      })
      .catch(e => next(e))
  }
}

function updateSingle(req, res, next, fromRevision = false) {
  const metadata = req.entity
  const subEntityId = req.body.subEntityId
  const nextBody = req.body.nextBody

  console.debug("metadata.data[subEntityId]", metadata.data[subEntityId])
  console.debug("nextBody", nextBody)
  req.body.prevBody = metadata.data[subEntityId] || -1

  if (nextBody === -1) {
    // remove attribute again
    delete metadata.data[subEntityId]
  } else {
    metadata.data[subEntityId] = nextBody
  }
  console.debug("metadata.data", metadata.data)
  metadata.markModified('data')
  metadata.save()
    .then(() => { if (!fromRevision) next() })
    .catch((e) => { if (!fromRevision) next(e) })
}

function updateLink(addLink) {
  return (req, res, next) => {
    const linkedItemType1 = req.body.linkedItemType1
    const linkedItemType2 = req.body.linkedItemType2
    const linkedItemKey1 = req.body.linkedItemKey1
    const linkedItemKey2 = req.body.linkedItemKey2
    const type1 = req.body.type1
    const type2 = req.body.type2

    // if (!linkedItemType1 ||
    //   !linkedItemType2 ||
    //   (linkedItemType1 !== "m" && linkedItemType1 !== "me") ||
    //   (linkedItemType2 !== "m" && linkedItemType2 !== "me") ||
    //   (linkedItemType1 !== "markers" && linkedItemType1 !== "metadata") ||
    //   (linkedItemType2 !== "markers" && linkedItemType2 !== "metadata")) {
    //   return res.status(400).send('linkedItemType1 and linkedItemType2 in body must either be "m", "me", "markers", "metadata"')
    // }

    // is either 0:mykey (for markers) and 1:mykey (for metadata)
    const prevValue1 = req.entity.data[linkedTypeAccessor[linkedItemType1] + ":" + linkedItemKey1] || false
    const prevValue2 = req.entity.data[linkedTypeAccessor[linkedItemType2] + ":" + linkedItemKey2] || false

    let newNextBody1 = (prevValue1) ? prevValue1 : [
      [],
      [],
    ]

    let newNextBody2 = (prevValue2) ? prevValue2 : [
      [],
      [],
    ]

    if (addLink) {
      if (newNextBody1[linkedTypeAccessor[linkedItemType2]].map(el => el[0]).indexOf(linkedItemKey2) === -1) newNextBody1[linkedTypeAccessor[linkedItemType2]].push([linkedItemKey2, type2]) // [linkedItemKey2, type2] ?
      if (newNextBody2[linkedTypeAccessor[linkedItemType1]].map(el => el[0]).indexOf(linkedItemKey1) === -1) newNextBody2[linkedTypeAccessor[linkedItemType1]].push([linkedItemKey1, type1])
    }
    else {
      newNextBody1[linkedTypeAccessor[linkedItemType2]] = newNextBody1[linkedTypeAccessor[linkedItemType2]].filter((el) => el[0] !== linkedItemKey2)
      newNextBody2[linkedTypeAccessor[linkedItemType1]] = newNextBody2[linkedTypeAccessor[linkedItemType1]].filter((el) => el[0] !== linkedItemKey1)

      if (newNextBody1[linkedTypeAccessor[linkedItemType2]] && newNextBody1[0].length === 0 && newNextBody1[1].length === 0 ) newNextBody1 = -1
      if (newNextBody2[linkedTypeAccessor[linkedItemType2]] && newNextBody2[0].length === 0 && newNextBody2[1].length === 0 ) newNextBody2 = -1
    }

    req.body.nextBody = newNextBody1
    req.body.subEntityId = linkedTypeAccessor[linkedItemType1] + ":" + linkedItemKey1
    updateSingle(req, res, next, true)
    revisionCtrl.addUpdateSingleRevision(req, res, next, false)


    req.body.nextBody = newNextBody2
    req.body.subEntityId = linkedTypeAccessor[linkedItemType2] + ":" + linkedItemKey2
    updateSingle(req, res, next, true)
    revisionCtrl.addUpdateSingleRevision(req, res, next)
  }
}

function getLinked(req, res, next) {
  const sourceItem = req.query.source || false

  const MAPIDS = ['a', 'b']
  const MEDIAIDS = ['e', 'b']

  if (!sourceItem) return res.status(400).send('query parameter "source" is required in the form of 0:markerId or 1:metadataId.')

  const linkedItems = req.entity.data[sourceItem] || false
  const resObj = {
    map: [],
    media: []
  }

  if (!linkedItems) {
    res.json(resObj)
  }

  const idTypeObj = {}
  const markerIdList = linkedItems[0].map((el) => {
    idTypeObj[el[0]] = el[1]
    return el[0]
  })
  const metadataIdList = linkedItems[1].map((el) => {
    idTypeObj[el[0]] = el[1]
    return el[0]
  })

  const mongoSearchQueryMarker = { _id: { $in: markerIdList } }
  const mongoSearchQueryMetadata = { _id: { $in: metadataIdList } }

  // TODO: links collection should be cached!

  console.debug(mongoSearchQueryMetadata,mongoSearchQueryMarker)
  Metadata.find(mongoSearchQueryMetadata)
    .exec()
    .then((metadata) => {
      Marker.find(mongoSearchQueryMarker)
        .exec()
        .then((markers) => {
          const fullList = markers.map(feature => ({
            properties: {
              n: feature.name || (feature.data || {}).title || feature.name,
              w: feature._id,
              y: feature.year,
              t: feature.type,
              f: (feature.data || {}).geojson,
              c: (feature.data || {}).content,
              s: feature.score,
              ct: 'marker'
            },
            geometry: {
              coordinates: feature.coo,
              type: 'Point'
            },
            type: 'Feature'
          })).concat(metadata.map(feature => ({
            properties: {
              n: feature.name || (feature.data || {}).title || feature._id,
              w: feature._id || feature.wiki,
              s: (feature.data || {}).source,
              y: feature.year,
              f: (feature.data || {}).geojson,
              c: (feature.data || {}).content,
              t: feature.subtype || feature.type,
              ct: 'metadata'
            },
            geometry: {
              coordinates: feature.coo,
              type: 'Point'
            },
            type: 'Feature'
          })))

          fullList.forEach((el) => {
            if (MAPIDS.includes(idTypeObj[el.properties.w])) {
              resObj.map.push(el)
            }
            if (MEDIAIDS.includes(idTypeObj[el.properties.w])) {
              resObj.media.push(el)
            }
          })

          return res.json(resObj)
        })
    })
}

/**
 * Get metadata list.
 * @property {number} req.query.offset - Number of metadata to be skipped.
 * @property {number} req.query.length - Limit number of metadata to be returned.
 * @returns {Metadata[]}
 */
function list(req, res, next) {
  const { start = 0, end = 10, count = 0, sort = 'createdAt', order = 'asc', filter = '' } = req.query
  const limit = end - start
  const fList = req.query.f || false
  const type = req.query.type || false
  const subtype = req.query.subtype || false
  const year = +req.query.year || false
  const delta = +req.query.delta || 10
  const wiki = req.query.wiki || false
  const search = req.query.search || false

  Metadata.list({ start, end, sort, order, filter, fList, type, subtype, year, delta, wiki, search })
    .then((metadata) => {
      if (count) {
        Metadata.count().exec().then((metadataCount) => {
          res.set('Access-Control-Expose-Headers', 'X-Total-Count')
          res.set('X-Total-Count', metadataCount)
          res.json(metadata)
        })
      } else {
        res.json(metadata)
      }
    })
    .catch(e => next(e))
}

/**
 * Delete metadata.
 * @returns {Metadata}
 */
function remove(req, res, next, fromRevision = false) {
  const metadata = req.entity
  metadata.remove()
    .then((deletedMarker) => {
      if (!fromRevision) {
        res.json(deletedMarker)
      }
    })
    .catch(e => next(e))
}

function defineEntity(req, res, next) {
  req.resource = 'metadata'
  next()
}

export default { defineEntity, getLinked, load, get, updateLink, create, update, updateSingle, list, remove, vote }
