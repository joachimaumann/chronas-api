
#create westeu
az group create --name chronas-k8s --location westeu
az aks create --resource-group chronas-k8s --name myK8sCluster --agent-count 1 --generate-ssh-keys
az aks get-credentials --resource-group=chronas-k8s --name=myK8sCluster -f ./myk8sclusterConfig


#create ukwest - not working
az group create --name chronas-k8s-uk --location ukwest
az aks create --resource-group chronas-k8s-uk --name myK8sCluster --agent-count 1 --generate-ssh-keys -s Standard_DS1_v2
az group delete --name chronas-k8s-uk --yes



#get credentials
#dashbaord
az aks browse --resource-group chronas-k8s --name myK8sCluster


az group delete --name chronas-k8s --yes

#TODO
#write mongo db data to disk
#api port change to 80
#rework dockerfiles
#check how to update existing pods