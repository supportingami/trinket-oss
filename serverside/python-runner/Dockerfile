FROM python:3.10-bullseye

RUN apt-get clean && apt-get update -y && \
    apt-get install -y --no-install-recommends \
    software-properties-common \
    fontconfig \
    locales-all \
    build-essential \
    pkg-config \
    libgeos-dev \
    libxml2-dev \
    libxslt1-dev \
    libcairo2 \
    libpango-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    shared-mime-info \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

# Upgrade pip, wheel, and setuptools (pinned <70 for pygal pkg_resources support)
RUN pip3 install --no-cache-dir --upgrade pip wheel "setuptools<70"


# Install Python packages (Pygal, Cairo, Matplotlib, NumPy, etc.)
COPY ./requirements.txt /tmp/
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt && \
    bokeh sampledata


# Install Node.js 18 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pm2 && \
    rm -rf /var/lib/apt/lists/*

# Setup user & session directories
RUN groupadd -g 1000 trinket && \
    useradd -u 1000 -g trinket -m -s /bin/bash trinket && \
    mkdir -p /tmp/sessions /tmp/python-generated && \
    chmod 777 /tmp/sessions /tmp/python-generated

WORKDIR /home/trinket

# Copy package files and install Node dependencies
COPY package.json ./
RUN npm install --production

# Copy application files
COPY . ./

# Initialize matplotlib font cache
ENV PYTHONPATH /home/trinket/python3
ENV MPLBACKEND module://trinket_backend
ENV MPLCONFIGDIR /tmp
RUN python3 /home/trinket/python3/init.py

# Cleanup build-essential and lock permissions on sensitive system binaries
RUN apt-get --purge -y autoremove build-essential && \
    chmod 744 /usr/bin/fallocate /usr/bin/git* /usr/local/bin/pip* /usr/bin/gcc* /usr/bin/curl

EXPOSE 8080

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
