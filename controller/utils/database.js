const fs = require('fs-extra');
const path = require('path');

var dependencies = require('../../controller/manager/dependencies');
var errorResponses = require('../../response/error');
var mkdirp = require('mkdirp');
var Portfolio = require('../../models/portfolio');
var Screenshot = require('../../models/screenshot');

module.exports = {
	
	/* FIND */
	
	findPortfoliosPaginated: function(startDate, perPage, callback) {
		var query = !startDate ? {} : { createdAt: { $lt: startDate } };

		Portfolio
			.find(query)
			.limit(perPage)
			.sort('-createdAt')
			.populate('screenshots')
			.exec(
				function(err, response) {
					if(err) {
						return callback(500, errorResponses.errorDatabase(err));
					}

					for(var i = 0; i < response.length; i++) {
						response[i] = response[i].replaceId();
						delete response[i].screenshots;
					}

					return callback(200, response);
				}
			);
	},

	findPortfolio: function(portfolioId, callback) {
		Portfolio
			.findOne({_id:portfolioId})
			.populate('screenshots')
			.exec(
				function(err, response) {
					if(err) {
						return callback(500, errorResponses.errorDatabase(err));
					}

					if(!response) {
						return callback(404, errorResponses.errorDoesNotExist('Portfolio'));
					}

					response = response.replaceId();
					for(var i = 0; i < response.screenshots.length; i++) {
						var screenshot = new Screenshot(response.screenshots[i]);
						response.screenshots[i] = screenshot.replaceId();
					}

					return callback(200, response);
				}
			);
	},
	
	findScreenshot: function(portfolioId, screenshotId, callback) {
		module.exports.findPortfolio(portfolioId,
			function(status, response) {
				if(status != 200) {
					return callback(status, response);
				}

				Screenshot
					.findOne({ _id:screenshotId})
					.exec(function(err, response) {
						if(err) {
							return callback(500, errorResponses.errorDatabase(err));
						}

						if(!response) {
							return callback(404, errorResponses.errorDoesNotExist('Screenshot'));
						}

						return callback(200, response);
					}
				);
			}
		);
	},
	
	/* INSERT */
	
	insertPortfolio: function(portfolio, callback) {
		portfolio.save(
			function(err, response) {
				if(err) {
					return callback(500, errorResponses.errorDatabase(err));
				}

				response = response.replaceId();

				return callback(201, response);
			}
		);
	},


	insertScreenshot: function(portfolioId, file, callback) {
		module.exports.findPortfolio(portfolioId,
			function(status, response) {
				if(status != 200) {
					fs.removeSync(dependencies.output + file.filename, function(err) {
						if(err) {
							return callback(500, err);
						}
					});

					return callback(status, response);
				}

				var fileFolderSource = path.resolve('./' + dependencies.output);
				var fileFolderDest = path.resolve('./' + dependencies.output + '/' + portfolioId);

				mkdirp(fileFolderDest,
					function(err) {
						if(err) {
							fs.removeSync(dependencies.output + file.filename,
								function(err) {
									if(err) {
										return callback(500, err);
									}
								}
							);

							return res.json({ error: 'Error while trying to create folder: ' + fileFolderDest });
						}

						fs.rename(fileFolderSource + '/' + file.filename, fileFolderDest + '/' + file.filename,
							function(err) {
								if(err) {
									return callback(500, err);
								}

								var screenshotObject = new Screenshot({portfolio: portfolioId});
								screenshotObject.image = path.resolve(fileFolderDest + '/' + file.filename);
								screenshotObject.save(
									function(err, screenshot) {
										if(err) {
											return callback(500, errorResponses.errorDatabase(err));
										}

										screenshot = screenshot.replaceId();
										return callback(201, screenshot);
									}
								);
							}
						);
					}
				);

			}
		)
	},

	/* REMOVE */
	
	removePortfolio: function(portfolioId, callback) {
		module.exports.findPortfolio(portfolioId,
			function(status, response) {
				if(status != 200) {
					return callback(status, response);
				}

				Portfolio
					.remove({ _id:portfolioId })
					.exec(function(err) {
						if(err) {
							return callback(500, err);
						}

						Screenshot
							.remove({ portfolio:portfolioId })
							.exec(function(err) {
								if(err) {
									return callback(500, err);
								}

								var fileFolderDest = path.resolve('./' + dependencies.output + '/' + portfolioId);

								fs.removeSync(fileFolderDest,
									function(err) {
										if(err) {
											return callback(500, err);
										}
									}
								);

								return callback(200, { id:portfolioId });
							}
						);
					}
				);
			}
		);
	},

	removeScreenshot: function(portfolioId, screenshotId, callback) {
		module.exports.findPortfolio(portfolioId,
			function(status, response) {
				if(status != 200) {
					return callback(status, response);
				}

				const portfolio = response;

				module.exports.findScreenshot(portfolioId, screenshotId,
					function(status, response) {
						if(status != 200) {
							return callback(status, response);
						}

						const screenshot = response;

						Screenshot
							.remove({ _id:screenshotId })
							.exec(
								function(err) {
									if(err) {
										return callback(500, err);
									}

									fs.removeSync(screenshot.image, function(err) {
										if(err) {
											return callback(500, err);
										}
									});

									return callback(200, { id:screenshotId });
								}
							);
					}
				);
			}
		);
	}
} 