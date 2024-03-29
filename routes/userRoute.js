require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })
const express = require('express')
const router = express.Router()

const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

const crypto = require('crypto')
const bcrypt = require('bcrypt')
const saltRounds = 10

const auth = require('../middlewares').auth
const findUser = require('../middlewares').findUser
const deleteToken = require('../middlewares').deleteToken

//signup
router.post('/signup', async (req, res) => {
  bcrypt.hash(req.body.password, saltRounds).then(async hash => {
    await prisma.user
      .create({
        data: {
          email: req.body.email,
          password: hash,
          first_name: req.body.firstName,
          last_name: req.body.lastName
        }
      })
      .then(() => {
        res.status(200).send('Successfully created an account!')
      })
      .catch(err => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          res.status(409).send('A user with this email already exists')
        } else {
          res.status(500).send('Internal server error')
        }
      })
  })
})

//login
router.post('/login', findUser, (req, res) => {
  if (req.user) {
    bcrypt.compare(req.body.password, req.user.password).then(async result => {
      if (result) {
        if (req.user.approved) {
          const token = crypto.randomBytes(64).toString('hex')

          await prisma.tokens
            .create({
              data: {
                userId: req.user.id,
                token: token
              }
            })
            .then(() => {
              res.status(200).send({
                userID: req.user.id,
                token: token
              })
            })
            .catch(() => res.status(500).send('Internal server error'))
        } else {
          res.status(401).send('Account not yet approved')
        }
      } else {
        res.status(401).send('Wrong password')
      }
    })
  } else {
    res.status(400).send("Account doesn't exist")
  }
})

//get user details
router.get('/:id', auth, async (req, res) => {
  await prisma.user
    .findUnique({
      where: {
        id: req.params.id
      },
      select: {
        email: true,
        first_name: true,
        last_name: true
      }
    })
    .then(user =>
      res.status(200).send({
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      })
    )
    .catch(() => res.status(500).send('Internal server error'))
})

//update account
router.put('/:id', auth, async (req, res) => {
  await prisma.user
    .update({
      where: {
        id: req.params.id
      },
      data: req.body
    })
    .then(() => res.status(200).send('User updated'))
    .catch(() => res.status(500).send('Internal server error'))
})

//delete token on logout
router.delete('/', auth, async (req, res) => {
  await prisma.tokens
    .delete({
      where: {
        token: req.headers.authorization.split(' ')[1]
      }
    })
    .then(() => res.status(200).send('token deleted'))
    .catch(err => res.status(500).send('Internal server error'))
})

//delete account
router.delete('/:id', auth, deleteToken, async (req, res) => {
  await prisma.user
    .delete({
      where: {
        id: req.params.id
      }
    })
    .then(() => res.status(200).send('Account deleted'))
    .catch(() => res.status(500).send('Internal server error'))
})

module.exports = router
