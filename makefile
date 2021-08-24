export REGION						:= ap-southeast-2
export ECR_REPO_URL					:= 533545012068.dkr.ecr.ap-southeast-2.amazonaws.com
export BRANCH_NAME					:=$(shell git branch --show-current)
export IP_WEB_DIA					:=$(shell cd terraform/ap-southeast-2 && terraform output -json | jq .info.value.aws_ins_ip )


local:
	docker-compose -f docker-compose-local.yaml up --build --force-recreate --remove-orphans -d

local-down:
	docker-compose -f docker-compose-local.yaml down

run: ecr-login 
	docker-compose up --build --force-recreate --remove-orphans -d

redeploy: clean run

ecr-login:
	aws ecr get-login-password \
    --region ${REGION} \
	| docker login \
		--username AWS \
		--password-stdin ${ECR_REPO_URL}

ecr: ecr-login
	-aws ecr create-repository --repository-name demo-issuer-api > /dev/null
	-aws ecr create-repository --repository-name demo-issuer-frontend > /dev/null
	-aws ecr create-repository --repository-name demo-issuer-nginx > /dev/null

build-api:
	cd api && docker build -f ./Dockerfile --no-cache -t demo-issuer-api:latest  .
	docker tag demo-issuer-api:latest $(ECR_REPO_URL)/demo-issuer-api:latest
	docker push $(ECR_REPO_URL)/demo-issuer-api:latest

build-frontend:
	cd frontend && docker build -f ./Dockerfile --no-cache -t demo-issuer-frontend:latest  .
	docker tag demo-issuer-frontend:latest $(ECR_REPO_URL)/demo-issuer-frontend:latest
	docker push $(ECR_REPO_URL)/demo-issuer-frontend:latest

build-nginx:
	cd nginx  && docker build -f ./Dockerfile --no-cache -t demo-issuer-nginx:latest  .	
	docker tag demo-issuer-nginx:latest $(ECR_REPO_URL)/demo-issuer-nginx:latest
	docker push $(ECR_REPO_URL)/demo-issuer-nginx:latest

build: build-api build-frontend build-nginx

down:
	docker-compose -f ./docker-compose-local.yml stop -t 1

clean:
	docker-compose stop -t 1
	docker-compose rm -f
	docker rmi -f $(shell docker images -q)

destroy:
	cd terraform/ap-southeast-2 && terraform destroy -var="branch_name=$(BRANCH_NAME)" --auto-approve 

deploy: destroy
	cd terraform/ap-southeast-2 && terraform apply -var="branch_name=$(BRANCH_NAME)" --auto-approve

remotedeploy: ecr-login build
	ssh -i ~/.ssh/ec2_key.pem ubuntu@$(IP_WEB) -t 'cd repo && make redeploy'