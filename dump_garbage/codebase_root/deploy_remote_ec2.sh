#!/bin/bash
set -ex

TIMESTAMP=$(date +%s)
echo "Starting deployment at $TIMESTAMP"
mkdir -p /home/ec2-user/school-app/logs

if ! command -v python3.11 >/dev/null 2>&1; then
    echo "Installing Python 3.11..."
    sudo dnf install -y python3.11 python3.11-pip
fi

if [ -f "/home/ec2-user/backend.tar.gz" ]; then
    echo "Deploying Backend..."
    if [ -d "/home/ec2-user/school-app/backend" ]; then
        mv /home/ec2-user/school-app/backend /home/ec2-user/school-app/backend_backup_$TIMESTAMP
    fi
    mkdir -p /home/ec2-user/school-app/backend
    tar -xzf /home/ec2-user/backend.tar.gz -C /home/ec2-user/school-app/backend

    if [ -f "/home/ec2-user/.env" ]; then
        mv /home/ec2-user/.env /home/ec2-user/school-app/backend/.env
    elif [ -f "/home/ec2-user/school-app/backend_backup_$TIMESTAMP/.env" ]; then
        cp /home/ec2-user/school-app/backend_backup_$TIMESTAMP/.env /home/ec2-user/school-app/backend/
    fi

    if [ -d "/home/ec2-user/school-app/venv" ]; then
        VENV_VERSION=$(/home/ec2-user/school-app/venv/bin/python -c "import sys; print(sys.version_info[1])" 2>/dev/null || echo "0")
        if [ "$VENV_VERSION" -ne 11 ]; then
            echo "Removing old virtual environment (version 3.$VENV_VERSION)..."
            rm -rf /home/ec2-user/school-app/venv
        fi
    fi

    if [ ! -d "/home/ec2-user/school-app/venv" ]; then
        echo "Creating virtual environment with Python 3.11..."
        python3.11 -m venv /home/ec2-user/school-app/venv
    fi

    /home/ec2-user/school-app/venv/bin/pip install -r /home/ec2-user/school-app/backend/requirements.txt
    /home/ec2-user/school-app/venv/bin/python /home/ec2-user/school-app/backend/manage.py migrate
    /home/ec2-user/school-app/venv/bin/python /home/ec2-user/school-app/backend/manage.py collectstatic --no-input

    if [ -f "/home/ec2-user/gunicorn.service" ]; then
        echo "Updating Gunicorn service file in systemd..."
        sudo cp /home/ec2-user/gunicorn.service /etc/systemd/system/gunicorn.service
    fi

    if [ -f "/home/ec2-user/biometric-tcp.service" ]; then
        echo "Updating biometric TCP service file in systemd..."
        sudo cp /home/ec2-user/biometric-tcp.service /etc/systemd/system/biometric-tcp.service
    fi

    sudo systemctl daemon-reload
    sudo systemctl enable gunicorn
    sudo systemctl restart gunicorn
    sudo systemctl enable biometric-tcp
    sudo systemctl restart biometric-tcp
    echo "Backend deployed successfully."
fi

if [ -f "/home/ec2-user/frontend.tar.gz" ]; then
    echo "Deploying Frontend..."
    if [ -d "/var/www/school-frontend" ]; then
        sudo mv /var/www/school-frontend /var/www/school-frontend_backup_$TIMESTAMP
    fi
    sudo mkdir -p /var/www/school-frontend
    sudo tar -xzf /home/ec2-user/frontend.tar.gz -C /var/www/school-frontend
    sudo chown -R nginx:nginx /var/www/school-frontend
    echo "Frontend deployed successfully."
fi

if [ -f "/home/ec2-user/nginx.conf" ]; then
    echo "Updating main Nginx configuration..."
    sudo cp /home/ec2-user/nginx.conf /etc/nginx/nginx.conf
fi

if [ -f "/home/ec2-user/school.conf" ]; then
    echo "Updating site configuration..."
    sudo cp /home/ec2-user/school.conf /etc/nginx/conf.d/school.conf
fi

echo "Starting and enabling Nginx..."
sudo systemctl enable nginx
sudo systemctl restart nginx

rm -f /home/ec2-user/backend.tar.gz
rm -f /home/ec2-user/frontend.tar.gz
rm -f /home/ec2-user/nginx.conf
rm -f /home/ec2-user/school.conf
rm -f /home/ec2-user/gunicorn.service
rm -f /home/ec2-user/biometric-tcp.service

echo "Deployment completed successfully!"
ce_ip",
        "received_at",