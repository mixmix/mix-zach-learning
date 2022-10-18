const SecretStack = require('secret-stack')
const caps = require('ssb-caps')
const ssbKeys = require('ssb-keys')
const { join } = require('path')
const waterfall = require('run-waterfall')

const DB_PATH = join(__dirname, '../db')

const peers = require('./peers.js')

module.exports = function SSB (opts = {}) {
  const stack = SecretStack({ caps })
    .use([
      require('ssb-db2/core'),
      require('ssb-db2/compat/publish'),
      require('ssb-classic'),
      // require('ssb-box'),
      // require('ssb-box2'),
      require('ssb-db2/compat/ebt'),
      // require('ssb-db2/compat/post'),
      require('ssb-db2/compat/db')
      // require('ssb-db2/migrate'),
    ])
    .use(require('ssb-about-self'))
    .use(require('ssb-threads'))

    .use(require('ssb-friends'))
    .use(require('ssb-ebt'))
    // .use(require('ssb-conn'))
    .use(require('ssb-conn/core'))
    .use(require('ssb-conn/compat')) // for ssb.gossip
    // use a minimal ssb-conn, exlcuding the scheduler,
    // which would otherwise prune connections down to 3

  // Staltz recommends writing own scheduler, see README for template
  // simple idea could be:
  // 1. bootstrap with hosts above
  // 2. live query to discover 'pub' messages with hosts
  // 3. cycle through a series of different connections to discover more messages
  // outstanding question: getStatus progress stuck?

    .use(require('ssb-replication-scheduler'))
    .use(require('ssb-blobs'))
    .use(require('ssb-serve-blobs'))

  const ssb = stack({
    keys: ssbKeys.loadOrCreateSync(join(DB_PATH, 'secret')),
    path: DB_PATH,
    friends: { hops: 6 },
    ...opts
  })

  peers.forEach(({ name, id, host, invite }) => {
    if (id) {
      waterfall(
        [
          (cb) => ssb.friends.isFollowing({ source: ssb.id, dest: id }, cb),
          (isFollowing, cb) => {
            if (isFollowing) cb(null, true)
            else ssb.friends.follow(id, { state: true }, cb)
          },
          (data, cb) => {
            if (host) ssb.conn.connect(host, cb)
            else cb(null)
          }
        ],
        (err, connection) => {
          if (err) console.error(err)
        }
      )
    }
  })

  return ssb
}
