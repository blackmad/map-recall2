#!/bin/bash
# In-game review shots for the historic lane (needs the dev server on LANDMARK_REVIEW_BASE).
cd "$(dirname "$0")/../.."
export LANDMARK_REVIEW_BASE=${LANDMARK_REVIEW_BASE:-http://127.0.0.1:4405} VIEWS=front=3.5
node scripts/landmarks/museums2-review.mjs compagnietheater 250 19.0 55
node scripts/landmarks/museums2-review.mjs west-indian-warehouse 330 19.2 55
node scripts/landmarks/museums2-review.mjs rijksakademie 340 18.3 55
node scripts/landmarks/museums2-review.mjs royal-tropical-institute 200 17.7 55
