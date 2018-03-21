#!/bin/bash

#kubectl create -f mongo-deployment.yml
#kubectl create -f mongo-service.yml
kubectl delete secret chronas-secrets
#kubectl create secret generic chronas-secrets --from-file=$(System.DefaultWorkingDirectory)/secrets
kubectl create -f chronas-secret.yml
kubectl apply -f chronas-map.yml
kubectl apply -f chronas-front-deployment.yml
kubectl apply -f chronas-front-service.yml